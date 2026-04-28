import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LogLevel } from "./logger/log-bus";

export interface CdkLocalConfig {
	cdkRoot?: string;
	stack?: string;
	stage?: string;
	logLevel: LogLevel;
	logOutput: "stdout" | "file";
	manifestPath?: string;
}

const DEFAULTS: CdkLocalConfig = {
	logLevel: "info",
	logOutput: "stdout",
};

export function loadConfig(cwd: string, overrides?: Partial<CdkLocalConfig>): CdkLocalConfig {
	const configPath = join(cwd, ".cdk-local", "config.json");
	let fileConfig: Partial<CdkLocalConfig> = {};
	if (existsSync(configPath)) {
		try {
			fileConfig = JSON.parse(readFileSync(configPath, "utf8")) as Partial<CdkLocalConfig>;
		} catch {
			// ignore malformed config
		}
	}
	return { ...DEFAULTS, ...fileConfig, ...(overrides ?? {}) };
}
