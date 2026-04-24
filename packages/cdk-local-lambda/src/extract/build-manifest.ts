import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalLambda, LocalManifest, LocalRoute } from "../types";

import { normalizeEnv, splitHandler, stageKey } from "../utils/manifest";
import { sortRecord } from "../utils/object";
import type { CfnResources } from "./cfn-types";
import { buildAuthorizerLambdaMap } from "./parse-authorizers";
import { parseApiGatewayMethods } from "./parse-routes";
import { recoverEntry } from "./recover-entry";
import { resolveAssetDir } from "./resolve-asset";

export interface ExtractOptions {
	readonly cdkOut: string;
	readonly stack: string;
	readonly stage: string;
	readonly repoRoot?: string;
	readonly onWarning?: (message: string) => void;
}

export async function extractManifest(opts: ExtractOptions): Promise<LocalManifest> {
	const repoRoot = opts.repoRoot ?? process.cwd();
	const templatePath = join(opts.cdkOut, `${opts.stack}.template.json`);
	const template = JSON.parse(readFileSync(templatePath, "utf8")) as {
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
		if (!fn || fn.Type !== "AWS::Lambda::Function" || !fn.Properties) {
			throw new Error(`extractManifest: expected AWS::Lambda::Function at ${logicalId}`);
		}
		const props = fn.Properties;
		const functionName = typeof props.FunctionName === "string" ? props.FunctionName : null;
		const functionKey = functionName ? stageKey(functionName, opts.stage) : logicalId;
		const code = props.Code as { S3Key?: unknown } | undefined;
		const assetDir = resolveAssetDir({
			cdkOut: opts.cdkOut,
			stack: opts.stack,
			codeS3Key: code?.S3Key,
		});
		const entry = recoverEntry({
			assetDir,
			repoRoot,
			onWarning: opts.onWarning,
		});
		lambdas[functionKey] = {
			functionKey,
			lambdaLogicalId: logicalId,
			lambdaFunctionName: functionName ?? logicalId,
			assetDir,
			entry,
			handler: splitHandler(props.Handler),
			runtime: typeof props.Runtime === "string" ? props.Runtime : "nodejs22.x",
			environment: normalizeEnv(
				(props.Environment as { Variables?: unknown } | undefined)?.Variables,
				opts.onWarning,
				logicalId,
			),
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
					`extractManifest: authorizer ${m.authorizerLogicalId} on ${m.httpMethod} ${m.path} has no resolvable lambda`,
				);
			}
			authorizerKey = collect(authLambdaLogical);
		}
		const key = `${m.httpMethod} ${m.path}`;
		routes[key] = {
			method: m.httpMethod,
			path: m.path,
			functionKey,
			authorizerKey,
		};
	}

	return {
		source: "cdk-synth",
		stack: opts.stack,
		stage: opts.stage,
		cdkOut: opts.cdkOut,
		lambdas: sortRecord(lambdas),
		routes: sortRecord(routes),
	};
}
