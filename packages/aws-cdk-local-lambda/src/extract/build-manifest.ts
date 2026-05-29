import type { LocalLambda, LocalManifest, LocalRoute } from '../types';
import type { CfnResources } from './cfn-types';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeEnv, splitHandler, stageKey } from '../utils/manifest';
import { sortRecord } from '../utils/object';
import { buildAuthorizerLambdaMap } from './parse-authorizers';
import { parseApiGatewayMethods } from './parse-routes';
import { recoverEntry } from './recover-entry';
import { resolveAssetDir } from './resolve-asset';

/** Options for {@link extractManifest}. */
export interface ExtractOptions {
  /** Absolute path to the CDK output directory (e.g. `path.resolve("cdk.out")`). */
  readonly cdkOut: string;
  /** CloudFormation stack name to parse (must match the synthesised template filename). */
  readonly stack: string;
  /** Optional stage name; strips the `-<stage>-` infix from Lambda function names to produce stable keys. */
  readonly stage?: string;
  /** Repository root used when recovering TypeScript entry paths. Defaults to `process.cwd()`. */
  readonly repoRoot?: string;
  /** Called with non-fatal warning messages (e.g. env vars that couldn't be normalised). */
  readonly onWarning?: (message: string) => void;
  /** Called with verbose framework log lines. Pass `() => {}` to silence them. */
  readonly onFrameworkLog?: (message: string) => void;
}

/**
 * Parses a CDK-synthesised CloudFormation template and produces a {@link LocalManifest}
 * describing every Lambda function and API Gateway route in the stack.
 *
 * @example
 * ```ts
 * import { extractManifest } from "aws-cdk-local-lambda/extract";
 *
 * const manifest = await extractManifest({
 *   cdkOut: path.resolve("cdk.out"),
 *   stack: "MyStack",
 * });
 * ```
 */
export async function extractManifest(
  opts: ExtractOptions
): Promise<LocalManifest> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const templatePath = join(opts.cdkOut, `${opts.stack}.template.json`);
  const template = JSON.parse(readFileSync(templatePath, 'utf8')) as {
    Resources?: CfnResources;
  };
  const resources = template.Resources ?? {};

  const authorizerMap = buildAuthorizerLambdaMap(resources);
  const methods = parseApiGatewayMethods(resources);

  const lambdas: Record<string, LocalLambda> = {};
  const logicalIdToKey = new Map<string, string>();

  const collect = (logicalId: string): string => {
    const existing = logicalIdToKey.get(logicalId);
    if (existing) return existing;

    const fn = resources[logicalId];
    if (!fn || fn.Type !== 'AWS::Lambda::Function' || !fn.Properties) {
      throw new Error(
        `extractManifest: expected AWS::Lambda::Function at ${logicalId}`
      );
    }
    const props = fn.Properties;
    const functionName =
      typeof props.FunctionName === 'string' ? props.FunctionName : null;
    const functionKey = functionName
      ? stageKey(functionName, opts.stage)
      : logicalId;
    const code = props.Code as { S3Key?: unknown } | undefined;
    const assetDir = resolveAssetDir({
      cdkOut: opts.cdkOut,
      stack: opts.stack,
      codeS3Key: code?.S3Key
    });
    const entry = recoverEntry({
      assetDir,
      repoRoot,
      onWarning: opts.onWarning,
      onFrameworkLog: opts.onFrameworkLog
    });
    lambdas[functionKey] = {
      functionKey,
      lambdaLogicalId: logicalId,
      lambdaFunctionName: functionName ?? logicalId,
      assetDir,
      entry,
      handler: splitHandler(props.Handler),
      runtime: typeof props.Runtime === 'string' ? props.Runtime : 'nodejs22.x',
      environment: normalizeEnv(
        (props.Environment as { Variables?: unknown } | undefined)?.Variables,
        opts.onWarning,
        logicalId
      )
    };
    logicalIdToKey.set(logicalId, functionKey);
    return functionKey;
  };

  const routes: Record<string, LocalRoute> = {};

  for (const m of methods) {
    const functionKey = collect(m.lambdaLogicalId);
    let authorizerKey: string | null = null;
    if (m.authorizerLogicalId) {
      const authLambdaLogical = authorizerMap.get(m.authorizerLogicalId);
      if (!authLambdaLogical) {
        throw new Error(
          `extractManifest: authorizer ${m.authorizerLogicalId} on ${m.httpMethod} ${m.path} has no resolvable lambda`
        );
      }
      authorizerKey = collect(authLambdaLogical);
    }
    const key = `${m.httpMethod} ${m.path}`;
    routes[key] = {
      method: m.httpMethod,
      path: m.path,
      functionKey,
      authorizerKey
    };
  }

  return {
    source: 'cdk-synth',
    stack: opts.stack,
    stage: opts.stage,
    cdkOut: opts.cdkOut,
    lambdas: sortRecord(lambdas),
    routes: sortRecord(routes)
  };
}
