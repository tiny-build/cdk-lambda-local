import type { LocalManifest } from '../types';
import type { APIGatewayProxyResult } from 'aws-lambda';

import cors, { type CorsOptions } from 'cors';
import express, {
  type Application,
  type Request,
  type Response
} from 'express';

import {
  SUPPORTED_HTTP_METHODS,
  type SupportedHttpMethod
} from '../constants/http';
import {
  defaultWatchPaths,
  inferRepoRootFromManifest,
  sortRoutesBySpecificity
} from '../utils/local-app';
import {
  buildProxyEvent,
  buildRequestAuthorizerEvent,
  lambdaContext
} from './apigateway-proxy';
import { isAuthorizerAllow } from './authorizer';
import { startWatcher } from './hot-reloader';
import { ModuleLoader } from './module-loader';
import { toExpressPath } from './path-convert';
import { sendProxyResult } from './response-writer';

export interface ServerOptions {
  readonly manifest: LocalManifest;
  /** When set with {@link onManifestChange}, this file is watched so topology edits can surface. */
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
}

export interface ServerHandle {
  readonly app: Application;
  readonly routes: readonly string[];
  readonly stop: () => Promise<void>;
}

export async function createLocalApp(
  opts: ServerOptions
): Promise<ServerHandle> {
  const { manifest } = opts;

  const app = express();
  app.use(cors(opts.corsOptions ?? { origin: true, credentials: true }));
  app.use(express.json({ limit: opts.bodyLimit ?? '6mb' }));
  app.use(express.urlencoded({ extended: true }));

  const healthPath = opts.healthPath ?? '/__local/health';
  app.get(healthPath, (_req, res) => {
    res.json({ ok: true, stage: manifest.stage, pid: process.pid });
  });

  const repoRoot = opts.repoRoot ?? inferRepoRootFromManifest(manifest);
  const loader = new ModuleLoader({ repoRoot });
  const routes: string[] = [];

  const sorted = sortRoutesBySpecificity(manifest.routes);

  for (const [, route] of sorted) {
    const method = route.method.toLowerCase() as SupportedHttpMethod;
    if (!SUPPORTED_HTTP_METHODS.has(method)) continue;
    const expressPath = toExpressPath(route.path);

    const lambda = manifest.lambdas[route.functionKey];
    if (!lambda) {
      throw new Error(
        `createLocalApp: route ${route.method} ${route.path} references unknown lambda "${route.functionKey}"`
      );
    }
    const authorizer = route.authorizerKey
      ? manifest.lambdas[route.authorizerKey]
      : null;
    if (route.authorizerKey && !authorizer) {
      throw new Error(
        `createLocalApp: route ${route.method} ${route.path} references unknown authorizer "${route.authorizerKey}"`
      );
    }

    const handler = async (req: Request, res: Response): Promise<void> => {
      try {
        const apiPath = req.path || route.path;
        let authContext: Record<string, string> = {};
        if (authorizer) {
          const authHandler = await loader.load(authorizer);
          const authEvent = buildRequestAuthorizerEvent(req, {
            path: apiPath,
            httpMethod: route.method,
            stage: manifest.stage
          });
          const authResult = await authHandler(
            authEvent,
            lambdaContext(authorizer.lambdaFunctionName),
            () => {}
          );
          const decision = isAuthorizerAllow(authResult);
          if (!decision.allow) {
            res.status(403).json({ message: 'Forbidden' });
            return;
          }
          authContext = { ...decision.context };
        }

        const proxyEvent = buildProxyEvent(req, {
          path: apiPath,
          httpMethod: route.method,
          stage: manifest.stage,
          authorizerContext: authContext
        });

        const mainHandler = await loader.load(lambda);
        const out = (await mainHandler(
          proxyEvent,
          lambdaContext(lambda.lambdaFunctionName),
          () => {}
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
            message: err instanceof Error ? err.message : 'Internal error'
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
        manifestPath: opts.manifestPath
      });
    }
  }

  return {
    app,
    routes,
    stop: async () => {
      if (stopWatcher) await stopWatcher();
    }
  };
}
