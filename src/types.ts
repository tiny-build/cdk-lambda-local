export interface LocalLambda {
	readonly functionKey: string;
	readonly lambdaLogicalId: string;
	readonly lambdaFunctionName: string;
	readonly assetDir: string;
	readonly entry: string;
	readonly handler: string;
	readonly runtime: string;
	readonly environment: Readonly<Record<string, string>>;
}

export interface LocalRoute {
	readonly method: string;
	readonly path: string;
	readonly functionKey: string;
	readonly authorizerKey: string | null;
}

export interface LocalManifest {
	readonly source: "cdk-synth";
	readonly stack: string;
	readonly stage: string;
	readonly cdkOut: string;
	readonly lambdas: Readonly<Record<string, LocalLambda>>;
	readonly routes: Readonly<Record<string, LocalRoute>>;
}
