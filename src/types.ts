/** A single Lambda function extracted from a CDK CloudFormation template. */
export interface LocalLambda {
	/** Stable key used to look up this Lambda in the manifest (derived from function name or logical ID). */
	readonly functionKey: string;
	/** CloudFormation logical resource ID for this Lambda. */
	readonly lambdaLogicalId: string;
	/** The deployed function name as it appears in CloudFormation. */
	readonly lambdaFunctionName: string;
	/** Absolute path to the CDK asset directory containing the bundled handler code. */
	readonly assetDir: string;
	/** Absolute path to the TypeScript entry file recovered from the bundled asset. */
	readonly entry: string;
	/** Exported handler name (e.g. `"handler"`), extracted from the CloudFormation `Handler` property. */
	readonly handler: string;
	/** Lambda runtime identifier (e.g. `"nodejs22.x"`). */
	readonly runtime: string;
	/** Environment variables for this function, normalised to string values. */
	readonly environment: Readonly<Record<string, string>>;
}

/** An API Gateway route mapped to a Lambda function. */
export interface LocalRoute {
	/** HTTP method in upper-case (e.g. `"GET"`, `"POST"`). */
	readonly method: string;
	/** API Gateway path pattern (e.g. `"/users/{id}"`). */
	readonly path: string;
	/** Key into `LocalManifest.lambdas` for the handler Lambda. */
	readonly functionKey: string;
	/** Key into `LocalManifest.lambdas` for the custom authorizer Lambda, or `null` if none. */
	readonly authorizerKey: string | null;
}

/**
 * The complete local manifest produced by {@link extractManifest}.
 *
 * Pass this to {@link createLocalApp} to spin up the local HTTP server.
 */
export interface LocalManifest {
	/** Discriminator — always `"cdk-synth"`. */
	readonly source: "cdk-synth";
	/** CloudFormation stack name that was synthesised. */
	readonly stack: string;
	/** Optional stage name used to strip prefixes from Lambda function keys. */
	readonly stage: string | undefined;
	/** Absolute path to the CDK output directory (`cdk.out`). */
	readonly cdkOut: string;
	/** All Lambda functions keyed by their `functionKey`. */
	readonly lambdas: Readonly<Record<string, LocalLambda>>;
	/** All API Gateway routes keyed by `"METHOD /path"`. */
	readonly routes: Readonly<Record<string, LocalRoute>>;
}
