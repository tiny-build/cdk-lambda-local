import { randomUUID } from "node:crypto";
import type { APIGatewayProxyResult } from "aws-lambda";
import cors, { type CorsOptions } from "cors";
import express, { type Application, type Request, type Response } from "express";
import { SUPPORTED_HTTP_METHODS, type SupportedHttpMethod } from "../constants/http.js";
import { lambdaLogStore, patchConsole } from "../logger/console-patch.js";
import type { LogBus, LogEntry } from "../logger/log-bus.js";
import type { LocalManifest } from "../types.js";
import { applyLambdaEnv } from "../utils/env.js";
import {
	defaultWatchPaths,
	inferRepoRootFromManifest,
	sortRoutesBySpecificity,
} from "../utils/local-app.js";
import { buildProxyEvent, buildRequestAuthorizerEvent, lambdaContext } from "./apigateway-proxy.js";
import { isAuthorizerAllow } from "./authorizer.js";
import { startWatcher } from "./hot-reloader.js";
import { ModuleLoader } from "./module-loader.js";
import { toExpressPath } from "./path-convert.js";
import { sendProxyResult } from "./response-writer.js";

export interface ServerOptions {
	readonly manifest: LocalManifest;
	readonly manifestPath?: string;
	readonly watch?: boolean;
	readonly watchPaths?: readonly string[];
	readonly repoRoot?: string;
	readonly corsOptions?: CorsOptions;
	readonly bodyLimit?: string;
	readonly healthPath?: string;
	readonly onReload?: (changedPath: string, invalidatedCount: number) => void;
	readonly onError?: (err: unknown, req: Request) => void;
	readonly onManifestChange?: (path: string) => void;
	readonly onLog?: (entry: Omit<LogEntry, "time">) => void;
	readonly logBus?: LogBus;
}

export interface ServerHandle {
	readonly app: Application;
	readonly routes: readonly string[];
	readonly stop: () => Promise<void>;
}

export async function createLocalApp(opts: ServerOptions): Promise<ServerHandle> {
	const { manifest } = opts;

	const app = express();
	app.use(cors(opts.corsOptions ?? { origin: true, credentials: true }));
	app.use(express.json({ limit: opts.bodyLimit ?? "6mb" }));
	app.use(express.urlencoded({ extended: true }));

	const healthPath = opts.healthPath ?? "/__local/health";
	app.get(healthPath, (_req, res) => {
		res.json({ ok: true, stage: manifest.stage, pid: process.pid });
	});

	const repoRoot = opts.repoRoot ?? inferRepoRootFromManifest(manifest);
	const loader = new ModuleLoader({ repoRoot, onLog: opts.onLog });
	const routes: string[] = [];

	const sorted = sortRoutesBySpecificity(manifest.routes);

	for (const [, route] of sorted) {
		const method = route.method.toLowerCase() as SupportedHttpMethod;
		if (!SUPPORTED_HTTP_METHODS.has(method)) continue;
		const expressPath = toExpressPath(route.path);

		const lambda = manifest.lambdas[route.functionKey];
		if (!lambda) {
			throw new Error(
				`createLocalApp: route ${route.method} ${route.path} references unknown lambda "${route.functionKey}"`,
			);
		}
		const authorizer = route.authorizerKey ? manifest.lambdas[route.authorizerKey] : null;
		if (route.authorizerKey && !authorizer) {
			throw new Error(
				`createLocalApp: route ${route.method} ${route.path} references unknown authorizer "${route.authorizerKey}"`,
			);
		}

		const handler = async (req: Request, res: Response): Promise<void> => {
			const requestId = randomUUID();
			try {
				const apiPath = req.path || route.path;
				let authContext: Record<string, string> = {};
				if (authorizer) {
					applyLambdaEnv(authorizer.environment);
					const authHandler = await loader.load(authorizer);
					const authEvent = buildRequestAuthorizerEvent(req, {
						path: apiPath,
						httpMethod: route.method,
						stage: manifest.stage,
					});
					const authCtx = { lambdaName: authorizer.lambdaFunctionName, requestId };
					const authPatch = opts.logBus ? patchConsole({ ...authCtx, bus: opts.logBus }) : null;
					let authResult: unknown;
					try {
						authResult = await lambdaLogStore.run(authCtx, () =>
							authHandler(authEvent, lambdaContext(authorizer.lambdaFunctionName), () => {}),
						);
					} finally {
						authPatch?.restore();
					}
					const decision = isAuthorizerAllow(authResult);
					if (!decision.allow) {
						res.status(403).json({ message: "Forbidden" });
						return;
					}
					authContext = { ...decision.context };
				}

				const proxyEvent = buildProxyEvent(req, {
					path: apiPath,
					httpMethod: route.method,
					stage: manifest.stage,
					authorizerContext: authContext,
				});

				applyLambdaEnv(lambda.environment);
				const mainHandler = await loader.load(lambda);
				const lambdaCtx = { lambdaName: lambda.lambdaFunctionName, requestId };
				const patch = opts.logBus ? patchConsole({ ...lambdaCtx, bus: opts.logBus }) : null;
				let out: APIGatewayProxyResult | undefined;
				try {
					out = (await lambdaLogStore.run(lambdaCtx, () =>
						mainHandler(proxyEvent, lambdaContext(lambda.lambdaFunctionName), () => {}),
					)) as APIGatewayProxyResult | undefined;
				} finally {
					patch?.restore();
				}

				opts.onLog?.({
					level: "info",
					source: "framework",
					msg: `${route.method} ${route.path} → ${out?.statusCode ?? 200}`,
					data: { requestId, lambdaName: lambda.lambdaFunctionName },
				});

				sendProxyResult(res, out);
			} catch (err) {
				try {
					opts.onError?.(err, req);
				} catch {
					// ignored
				}
				const errMsg = err instanceof Error ? err.message : String(err);
				const errStack = err instanceof Error ? err.stack : undefined;
				opts.onLog?.({
					level: "error",
					source: "framework",
					msg: `${route.method} ${route.path} error: ${errMsg}${errStack ? `\n${errStack}` : ""}`,
					data: { requestId },
				});
				if (!res.headersSent) {
					res.status(500).json({
						message: err instanceof Error ? err.message : "Internal error",
					});
				}
			}
		};

		app[method](expressPath, (req, res) => {
			void handler(req, res);
		});

		routes.push(`${route.method} ${route.path}`);
	}

	let stopWatcher: (() => Promise<void>) | null = null;
	if (opts.watch !== false) {
		const paths =
			opts.watchPaths && opts.watchPaths.length > 0
				? [...opts.watchPaths]
				: defaultWatchPaths(manifest.lambdas);

		if (paths.length > 0) {
			stopWatcher = await startWatcher({
				paths,
				loader,
				onReload: opts.onReload,
				onManifestChange: opts.onManifestChange,
				manifestPath: opts.manifestPath,
				onLog: opts.onLog,
			});
		}
	}

	return {
		app,
		routes,
		stop: async () => {
			if (stopWatcher) await stopWatcher();
		},
	};
}
