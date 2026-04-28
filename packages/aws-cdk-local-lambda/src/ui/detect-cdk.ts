import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { glob } from "tinyglobby";

function hasCdkLib(dir: string): boolean {
	const pkgPath = join(dir, "package.json");
	if (!existsSync(pkgPath)) return false;
	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		return (
			"aws-cdk-lib" in (pkg.dependencies ?? {}) || "aws-cdk-lib" in (pkg.devDependencies ?? {})
		);
	} catch {
		return false;
	}
}

export async function detectCdkRoots(searchRoot: string): Promise<string[]> {
	const matches = await glob("**/cdk.json", {
		cwd: searchRoot,
		ignore: ["**/node_modules/**", "**/.git/**"],
		absolute: true,
	});

	return matches.map((f) => dirname(f)).filter((dir) => hasCdkLib(dir));
}
