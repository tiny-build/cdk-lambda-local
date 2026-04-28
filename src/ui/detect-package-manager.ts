import { existsSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

export function detectPackageManager(cwd: string): PackageManager {
	if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
	if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
	if (existsSync(join(cwd, "package-lock.json"))) return "npm";

	const ua = process.env.npm_config_user_agent ?? "";
	if (ua.startsWith("pnpm")) return "pnpm";
	if (ua.startsWith("yarn")) return "yarn";
	if (ua.startsWith("bun")) return "bun";

	return "npm";
}

export function addDevDependencyArgs(pm: PackageManager, pkg: string): string[] {
	switch (pm) {
		case "pnpm":
			return ["add", "-D", pkg];
		case "yarn":
			return ["add", "-D", pkg];
		case "bun":
			return ["add", "-d", pkg];
		case "npm":
			return ["install", "--save-dev", pkg];
	}
}
