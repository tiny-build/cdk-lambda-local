import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Options for {@link resolveAssetDir}. */
export interface ResolveAssetOptions {
	/** Absolute path to the CDK output directory. */
	readonly cdkOut: string;
	/** CloudFormation stack name (used to locate the `.assets.json` file). */
	readonly stack: string;
	/** Raw `Code.S3Key` value from the CloudFormation template — may be a string or `Fn::Sub` intrinsic. */
	readonly codeS3Key: unknown;
}

interface AssetsFile {
	readonly files?: Readonly<
		Record<
			string,
			{
				readonly source?: { readonly path?: string };
			}
		>
	>;
}

function extractHash(codeS3Key: unknown): string | null {
	let raw: string | null = null;
	if (typeof codeS3Key === "string") {
		raw = codeS3Key;
	} else if (typeof codeS3Key === "object" && codeS3Key !== null && "Fn::Sub" in codeS3Key) {
		const val = (codeS3Key as { "Fn::Sub": unknown })["Fn::Sub"];
		if (typeof val === "string") raw = val;
		else if (Array.isArray(val) && typeof val[0] === "string") raw = val[0];
	}
	if (!raw) return null;
	const tail = raw.split("/").pop() ?? raw;
	const m = /^([0-9a-f]{8,})\.(zip|Zip)$/.exec(tail);
	if (m?.[1]) return m[1];
	const m2 = /([0-9a-f]{16,})/.exec(raw);
	return m2?.[1] ?? null;
}

/**
 * Resolves the absolute path to a Lambda asset directory from the CDK assets manifest.
 *
 * Extracts the asset hash from `Code.S3Key`, looks it up in `<stack>.assets.json`,
 * and returns the path to the corresponding source directory inside `cdk.out`.
 */
export function resolveAssetDir(opts: ResolveAssetOptions): string {
	const hash = extractHash(opts.codeS3Key);
	if (!hash) {
		throw new Error(`Cannot extract asset hash from Code.S3Key: ${JSON.stringify(opts.codeS3Key)}`);
	}
	const assetsPath = join(opts.cdkOut, `${opts.stack}.assets.json`);
	const assets = JSON.parse(readFileSync(assetsPath, "utf8")) as AssetsFile;
	const file = assets.files?.[hash];
	const sourcePath = file?.source?.path;
	if (!sourcePath) {
		throw new Error(`No asset source path for hash "${hash}" in ${assetsPath}`);
	}
	return join(opts.cdkOut, sourcePath);
}
