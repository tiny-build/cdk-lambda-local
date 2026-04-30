import type { APIGatewayProxyResult } from "aws-lambda";
import cors, { type CorsOptions } from "cors";
import express, { type Application, type Request, type Response } from "express";
import { SUPPORTED_HTTP_METHODS, type SupportedHttpMethod } from "../constants/http";
import type { LocalManifest } from "../types";
import { applyLambdaEnv } from "../utils/env";
import {
	defaultWatchPaths,
	inferRepoRootFromManifest,
	sortRoutesBySpecificity,
} from "../utils/local-app";
import { buildProxyEvent, buildRequestAuthorizerEvent, lambdaContext } from "./apigateway-proxy";
import { isAuthorizerAllow } from "./authorizer";
import { startWatcher } from "./hot-reloader";
import { ModuleLoader } from "./module-loader";
import { toExpressPath } from "./path-convert";
import { sendProxyResult } from "./response-writer";

/** Options for {@link createLocalApp}. */
export interface ServerOptions {
	/** The manifest produced by {@link extractManifest}. Defines all routes and Lambdas. */
	readonly manifest: LocalManifest;
	/** When set with {@link ServerOptions.onManifestChange}, this file is watched so topology edits can surface. */
	readonly manifestPath?: string;
	/** Enable file-system watching and hot-reloading of Lambda handlers. Defaults to `true`. */
	readonly watch?: boolean;
	/** Override the directories watched for hot-reload. Defaults to the `src/` folder of each Lambda entry. */
	readonly watchPaths?: readonly string[];
	/** Repository root used when resolving module paths. Defaults to inference from `manifest.cdkOut`. */
	readonly repoRoot?: string;
	/** CORS configuration forwarded to the `cors` middleware. Defaults to `{ origin: true, credentials: true }`. */
	readonly corsOptions?: CorsOptions;
	/** Express body-parser size limit (e.g. `"10mb"`). Defaults to `"6mb"`. */
	readonly bodyLimit?: string;
	/** Path for the built-in health-check endpoint. Defaults to `"/__local/health"`. */
	readonly healthPath?: string;
	/** Called after a file change causes Lambda modules to be invalidated and reloaded. */
	readonly onReload?: (changedPath: string, invalidatedCount: number) => void;
	/** Called when a Lambda handler throws an unhandled error. Use for custom logging or alerting. */
	readonly onError?: (err: unknown, req: Request) => void;
	/** Called when the manifest file itself changes (requires `manifestPath` to be set). */
	readonly onManifestChange?: (path: string) => void;
	/**
	 * Called for each framework-level log line (file changes, module invalidations, etc.).
	 * Pass a no-op `() => {}` to silence all framework logs.
	 * Defaults to `console.error` when omitted.
	 */
	readonly onFrameworkLog?: (message: string) => void;
}

/** Handle returned by {@link createLocalApp} to inspect and shut down the server. */
export interface ServerHandle {
	/** The underlying Express application. Mount middleware or add routes before calling `app.listen()`. */
	readonly app: Application;
	/** List of registered routes in `"METHOD /path"` format. */
	readonly routes: readonly string[];
	/** Stops the file watcher and releases all resources. Does not close the HTTP server itself. */
	readonly stop: () => Promise<void>;
}

/**
 * Creates a local Express application that emulates API Gateway + Lambda from a {@link LocalManifest}.
 *
 * Each route in the manifest is mounted as an Express route. Incoming requests are converted
 * into `APIGatewayProxyEvent` objects and dispatched to the corresponding Lambda handler.
 * Optional custom authorizers run first and can short-circuit with a 403.
 *
 * Hot-reloading is enabled by default: when source files change, affected handlers are
 * re-bundled and reloaded without restarting the process.
 *
 * @example
 * ```ts
 * import { createLocalApp } from "aws-cdk-local-lambda/server";
 *
 * const { app, routes, stop } = await createLocalApp({ manifest });
 * const server = app.listen(3000, () => console.log("Listening on :3000"));
 * // routes: ["GET /users", "POST /users", ...]
 * ```
 */
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
	const onFrameworkLog = opts.onFrameworkLog ?? console.error;
	const loader = new ModuleLoader({ repoRoot, onFrameworkLog });
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
					const authResult = await authHandler(
						authEvent,
						lambdaContext(authorizer.lambdaFunctionName),
						() => {},
					);
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
				const out = (await mainHandler(
					proxyEvent,
					lambdaContext(lambda.lambdaFunctionName),
					() => {},
				)) as APIGatewayProxyResult | undefined;
				sendProxyResult(res, out);
			} catch (err) {
				try {
					opts.onError?.(err, req);
				} catch {
					// ignored
				}
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
				onFrameworkLog,
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
