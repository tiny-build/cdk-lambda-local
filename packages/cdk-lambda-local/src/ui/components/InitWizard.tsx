import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import React, { useEffect, useState } from "react";
import type { CdkLocalConfig } from "../../config";
import { extractManifest } from "../../extract/build-manifest";
import type { LogBus } from "../../logger/log-bus";
import { detectCdkRoots } from "../detect-cdk";
import {
	addDevDependencyArgs,
	detectPackageManager,
	type PackageManager,
} from "../detect-package-manager";
import { addToGitignore } from "../update-gitignore";

const PACKAGE_NAME = "cdk-lambda-local";

function loadDotEnv(dir: string): Record<string, string> {
	const envPath = join(dir, ".env");
	if (!existsSync(envPath)) return {};
	const result: Record<string, string> = {};
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const val = trimmed
			.slice(eq + 1)
			.trim()
			.replace(/^(['"])(.*)\1$/, "$2");
		if (key) result[key] = val;
	}
	return result;
}

function alreadyInstalled(cdkRoot: string): boolean {
	const pkgPath = join(cdkRoot, "package.json");
	if (!existsSync(pkgPath)) return false;
	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		return PACKAGE_NAME in (pkg.dependencies ?? {}) || PACKAGE_NAME in (pkg.devDependencies ?? {});
	} catch {
		return false;
	}
}

interface Props {
	cwd: string;
	bus: LogBus;
	onComplete: (config: CdkLocalConfig, manifestPath: string) => void;
}

type Step =
	| "welcome"
	| "detecting"
	| "pick-root"
	| "no-cdk"
	| "listing-stacks"
	| "pick-stack"
	| "stack-error"
	| "stage"
	| "log-level"
	| "log-output"
	| "installing"
	| "synthing"
	| "done";

export function InitWizard({ cwd, bus, onComplete }: Props): React.ReactElement {
	const { exit } = useApp();
	const [step, setStep] = useState<Step>("welcome");
	const [roots, setRoots] = useState<string[]>([]);
	const [cdkRoot, setCdkRoot] = useState("");
	const [stacks, setStacks] = useState<string[]>([]);
	const [stack, setStack] = useState("");
	const [stage, setStage] = useState("dev");
	const [logLevel, setLogLevel] = useState<CdkLocalConfig["logLevel"]>("info");
	const [logOutput, setLogOutput] = useState<CdkLocalConfig["logOutput"]>("stdout");
	const [error, setError] = useState("");
	const [statusMsg, setStatusMsg] = useState("");
	const [packageManager, setPackageManager] = useState<PackageManager>("npm");
	const [installMsg, setInstallMsg] = useState("");

	useInput((input, key) => {
		if (step === "welcome" && (key.return || input === " ")) {
			setStep("detecting");
		}
		if ((step === "no-cdk" || step === "stack-error") && key.return) exit();
	});

	useEffect(() => {
		if (step !== "detecting") return;
		void detectCdkRoots(cwd).then((found) => {
			if (found.length === 0) {
				setStep("no-cdk");
			} else if (found.length === 1) {
				setCdkRoot(found[0]!);
				setStep("listing-stacks");
			} else {
				setRoots(found);
				setStep("pick-root");
			}
		});
	}, [step, cwd]);

	useEffect(() => {
		if (step !== "listing-stacks") return;
		const tmpOut = join(os.tmpdir(), `cdk-local-ls-${Date.now()}`);
		try {
			const out = execSync(`cdk ls --output "${tmpOut}"`, {
				cwd: cdkRoot,
				encoding: "utf8",
				env: { ...process.env, ...loadDotEnv(cdkRoot) },
				shell: "/bin/sh",
			});
			const names = out.trim().split("\n").filter(Boolean);
			if (names.length === 0) {
				setError("No stacks found. Run `cdk synth` manually and use `cdk-local dev`.");
				setStep("stack-error");
			} else {
				setStacks(names);
				setStep("pick-stack");
			}
		} catch (e) {
			setError(`cdk ls failed: ${e instanceof Error ? e.message : String(e)}`);
			setStep("stack-error");
		}
	}, [step, cdkRoot]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot effect that captures config at install time
	useEffect(() => {
		if (step !== "installing") return;
		if (alreadyInstalled(cdkRoot)) {
			setInstallMsg(`${PACKAGE_NAME} already installed — skipping`);
			setStep("synthing");
			return;
		}
		const pm = detectPackageManager(cdkRoot);
		setPackageManager(pm);
		setInstallMsg(`installing ${PACKAGE_NAME} via ${pm}...`);
		const args = addDevDependencyArgs(pm, PACKAGE_NAME);
		const child = spawn(pm, args, {
			cwd: cdkRoot,
			stdio: "ignore",
			env: { ...process.env, ...loadDotEnv(cdkRoot) },
			shell: true,
		});
		child.on("error", (e) => {
			setError(`${pm} install failed: ${e.message}`);
			setStep("stack-error");
		});
		child.on("close", (code) => {
			if (code !== 0) {
				setError(`${pm} ${args.join(" ")} exited with code ${String(code)}`);
				setStep("stack-error");
				return;
			}
			setStep("synthing");
		});
	}, [step]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot effect that captures config at synth time
	useEffect(() => {
		if (step !== "synthing") return;
		const cdkOut = join(cdkRoot, "cdk.out");
		const manifestPath = join(cwd, ".cdk-local", "manifest.json");

		setStatusMsg("running cdk synth...");
		const child = spawn("cdk", ["synth", "--output", cdkOut], {
			cwd: cdkRoot,
			stdio: "ignore",
			env: { ...process.env, ...loadDotEnv(cdkRoot) },
			shell: true,
		});
		child.on("error", (e) => {
			setError(`cdk synth failed: ${e.message}`);
			setStep("stack-error");
		});
		child.on("close", (code) => {
			if (code !== 0) {
				setError(`cdk synth exited with code ${String(code)}`);
				setStep("stack-error");
				return;
			}
			setStatusMsg("extracting manifest...");
			void extractManifest({
				cdkOut,
				stack,
				stage,
				repoRoot: cdkRoot,
				onLog: (e) => bus.emit(e),
			})
				.then((m) => {
					mkdirSync(join(cwd, ".cdk-local"), { recursive: true });
					writeFileSync(manifestPath, JSON.stringify(m, null, 2), "utf8");
					const config: CdkLocalConfig = {
						cdkRoot,
						stack,
						stage,
						logLevel,
						logOutput,
						manifestPath: ".cdk-local/manifest.json",
					};
					writeFileSync(
						join(cwd, ".cdk-local", "config.json"),
						JSON.stringify(config, null, 2),
						"utf8",
					);
					try {
						addToGitignore(cwd, ".cdk-local/");
					} catch (gitErr) {
						bus.emit({
							level: "warn",
							source: "framework",
							msg: `could not update .gitignore: ${gitErr instanceof Error ? gitErr.message : String(gitErr)}`,
						});
					}
					onComplete(config, manifestPath);
				})
				.catch((e: unknown) => {
					setError(`extract failed: ${e instanceof Error ? e.message : String(e)}`);
					setStep("stack-error");
				});
		});
	}, [step]);

	if (step === "welcome") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green" bold>
					{"cdk-local init"}
				</Text>
				<Text color="gray">{"Set up local Lambda development for your CDK app."}</Text>
				<Text dimColor>{"Press Enter or Space to continue..."}</Text>
			</Box>
		);
	}

	if (step === "detecting") {
		return (
			<Box padding={1}>
				<Text color="cyan">{"⠋ scanning for CDK apps..."}</Text>
			</Box>
		);
	}

	if (step === "no-cdk") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red" bold>
					{"✗ No CDK app found"}
				</Text>
				<Text>
					{"Make sure your project has "}
					<Text color="cyan">{"cdk.json"}</Text>
					{" and "}
					<Text color="cyan">{"aws-cdk-lib"}</Text>
					{" installed."}
				</Text>
				<Text dimColor>{"Press Enter to exit."}</Text>
			</Box>
		);
	}

	if (step === "pick-root") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>{"Multiple CDK apps found. Select one:"}</Text>
				<SelectInput
					items={roots.map((r) => ({ label: r, value: r }))}
					onSelect={(item) => {
						setCdkRoot(item.value);
						setStep("listing-stacks");
					}}
				/>
			</Box>
		);
	}

	if (step === "listing-stacks") {
		return (
			<Box padding={1}>
				<Text color="cyan">
					{"⠋ listing stacks in "}
					{cdkRoot}
					{"..."}
				</Text>
			</Box>
		);
	}

	if (step === "pick-stack") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>{"Select a stack:"}</Text>
				<SelectInput
					items={stacks.map((s) => ({ label: s, value: s }))}
					onSelect={(item) => {
						setStack(item.value);
						setStep("stage");
					}}
				/>
			</Box>
		);
	}

	if (step === "stack-error") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red" bold>
					{"✗ Error"}
				</Text>
				<Text>{error}</Text>
				<Text dimColor>{"Press Enter to exit."}</Text>
			</Box>
		);
	}

	if (step === "stage") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>{"Stage name (e.g. dev, staging):"}</Text>
				<TextInput
					value={stage}
					onChange={setStage}
					onSubmit={() => setStep("log-level")}
					placeholder="dev"
				/>
			</Box>
		);
	}

	if (step === "log-level") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>{"Log level:"}</Text>
				<SelectInput
					items={[
						{ label: "trace", value: "trace" },
						{ label: "debug", value: "debug" },
						{ label: "info (default)", value: "info" },
						{ label: "warn", value: "warn" },
						{ label: "error", value: "error" },
					]}
					initialIndex={2}
					onSelect={(item) => {
						setLogLevel(item.value as CdkLocalConfig["logLevel"]);
						setStep("log-output");
					}}
				/>
			</Box>
		);
	}

	if (step === "log-output") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>{"Log output:"}</Text>
				<SelectInput
					items={[
						{ label: "stdout (default)", value: "stdout" },
						{ label: "file (.cdk-local/logs/dev.log)", value: "file" },
					]}
					onSelect={(item) => {
						setLogOutput(item.value as CdkLocalConfig["logOutput"]);
						setStep("installing");
					}}
				/>
			</Box>
		);
	}

	if (step === "installing") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan">
					{"⠋ "}
					{installMsg || `installing ${PACKAGE_NAME}...`}
				</Text>
				{packageManager !== "npm" && (
					<Text dimColor>
						{"  detected package manager: "}
						{packageManager}
					</Text>
				)}
			</Box>
		);
	}

	if (step === "synthing") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan">
					{"⠋ "}
					{statusMsg}
				</Text>
			</Box>
		);
	}

	return <Box />;
}
