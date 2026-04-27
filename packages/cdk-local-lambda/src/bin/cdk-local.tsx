#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Box, render, Text, useApp } from "ink";
import React, { useState } from "react";
import type { CdkLocalConfig } from "../config";
import { loadConfig } from "../config";
import { extractManifest } from "../extract/build-manifest";
import { LogBus } from "../logger/log-bus";
import { PinoLogger } from "../logger/pino-logger";
import { createLocalApp } from "../server/create-app";
import type { LocalManifest } from "../types";
import { DevDashboard } from "../ui/components/DevDashboard";
import { ExtractOutput } from "../ui/components/ExtractOutput";
import { InitWizard } from "../ui/components/InitWizard";

function abs(p: string): string {
	return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function parseCliArgs(): { command: string; args: Record<string, string | boolean | undefined> } {
	const [, , command = "help", ...rest] = process.argv;
	const { values } = parseArgs({
		args: rest,
		strict: false,
		options: {
			"cdk-out": { type: "string" },
			stack: { type: "string" },
			stage: { type: "string" },
			out: { type: "string" },
			synth: { type: "boolean", default: false },
			"repo-root": { type: "string" },
			manifest: { type: "string" },
			port: { type: "string", default: "3001" },
			watch: { type: "boolean", default: true },
			"no-watch": { type: "boolean", default: false },
		},
	});
	return { command, args: values as Record<string, string | boolean | undefined> };
}

// ── Dev / Serve component ────────────────────────────────────────────────────

interface DevAppProps {
	manifest: LocalManifest;
	port: number;
	bus: LogBus;
	watch: boolean;
	manifestPath?: string;
	repoRoot?: string;
}

function DevApp({
	manifest,
	port,
	bus,
	watch,
	manifestPath,
	repoRoot,
}: DevAppProps): React.ReactElement {
	const { exit } = useApp();
	const [ready, setReady] = useState(false);
	const shutdownRef = React.useRef<() => void>(() => {
		// during initial render, no server yet — exit immediately
		exit();
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot effect
	React.useEffect(() => {
		let server: import("node:http").Server | null = null;
		let serverHandle: { stop: () => Promise<void> } | null = null;
		let shuttingDown = false;

		const shutdown = (): void => {
			if (shuttingDown) return;
			shuttingDown = true;
			bus.emit({ level: "info", source: "framework", msg: "shutting down..." });
			const finish = (): void => {
				exit();
				// give Ink a moment to flush its render before we exit the process
				setTimeout(() => process.exit(0), 50);
			};
			const stopHandle = (): void => {
				if (serverHandle) {
					serverHandle.stop().finally(finish);
				} else {
					finish();
				}
			};
			if (server) {
				server.close(() => stopHandle());
				// fall back if close() hangs (e.g. open keep-alive connections)
				setTimeout(stopHandle, 1500).unref?.();
			} else {
				stopHandle();
			}
		};

		shutdownRef.current = shutdown;
		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);

		void createLocalApp({
			manifest,
			manifestPath,
			repoRoot,
			watch,
			logBus: bus,
			onLog: (e) => bus.emit(e),
			onReload: (path, count) => {
				bus.emit({ level: "info", source: "framework", msg: `reload: ${path} (${count} cached)` });
			},
			onManifestChange: (p) => {
				bus.emit({
					level: "warn",
					source: "framework",
					msg: `manifest changed (${p}); restart to apply route changes`,
				});
			},
			onError: (err) => {
				bus.emit({
					level: "error",
					source: "framework",
					msg: err instanceof Error ? err.message : String(err),
				});
			},
		}).then((h) => {
			serverHandle = h;
			server = h.app.listen(port, () => {
				bus.emit({
					level: "info",
					source: "framework",
					msg: `listening on http://localhost:${port} (${h.routes.length} routes)`,
				});
				setReady(true);
			});
			server.on("error", (err: Error) => {
				bus.emit({ level: "fatal", source: "framework", msg: `server error: ${err.message}` });
				shutdown();
			});
		});

		return () => {
			process.removeListener("SIGINT", shutdown);
			process.removeListener("SIGTERM", shutdown);
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	if (!ready) {
		return (
			<Box padding={1}>
				<Text color="cyan">{"⠋ starting server..."}</Text>
			</Box>
		);
	}

	return (
		<DevDashboard manifest={manifest} port={port} bus={bus} onQuit={() => shutdownRef.current()} />
	);
}

// ── Extract component ────────────────────────────────────────────────────────

function ExtractApp({
	cdkOut,
	stack,
	stage,
	out,
	synth,
	repoRoot,
	bus,
}: {
	cdkOut: string;
	stack: string;
	stage: string;
	out?: string;
	synth: boolean;
	repoRoot: string;
	bus: LogBus;
}): React.ReactElement {
	const { exit } = useApp();
	const [manifest, setManifest] = useState<LocalManifest | null>(null);
	const [error, setError] = useState("");

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot effect
	React.useEffect(() => {
		const run = async (): Promise<void> => {
			if (synth) {
				bus.emit({
					level: "info",
					source: "framework",
					msg: `running cdk synth in ${dirname(cdkOut)}...`,
				});
				await new Promise<void>((res, rej) => {
					const child = spawn("cdk", ["synth", "--output", cdkOut], {
						cwd: dirname(cdkOut),
						stdio: "inherit",
						env: process.env,
						shell: true,
					});
					child.on("close", (code: number | null) =>
						code === 0 ? res() : rej(new Error(`cdk synth exited with code ${String(code)}`)),
					);
					child.on("error", rej);
				});
			}
			const m = await extractManifest({
				cdkOut,
				stack,
				stage,
				repoRoot,
				onLog: (e) => bus.emit(e),
				onWarning: (w) => bus.emit({ level: "warn", source: "framework", msg: w }),
			});
			if (out) {
				const outPath = abs(out);
				mkdirSync(dirname(outPath), { recursive: true });
				writeFileSync(outPath, `${JSON.stringify(m, null, 2)}\n`, "utf8");
			} else {
				process.stdout.write(`${JSON.stringify(m, null, 2)}\n`);
			}
			setManifest(m);
		};
		run().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional effect with controlled deps
	React.useEffect(() => {
		if (manifest ?? error) {
			setTimeout(() => exit(), 100);
		}
	}, [manifest, error, exit]);

	if (error)
		return (
			<Box padding={1}>
				<Text color="red">
					{"✗ "}
					{error}
				</Text>
			</Box>
		);
	if (!manifest)
		return (
			<Box padding={1}>
				<Text color="cyan">{"⠋ extracting manifest..."}</Text>
			</Box>
		);
	return <ExtractOutput manifest={manifest} outPath={out ? abs(out) : undefined} />;
}

// ── Init component ───────────────────────────────────────────────────────────

function InitApp({ bus }: { bus: LogBus }): React.ReactElement {
	const cwd = process.cwd();
	const [config, setConfig] = useState<CdkLocalConfig | null>(null);
	const [manifestPath, setManifestPath] = useState("");

	const handleComplete = (cfg: CdkLocalConfig, mPath: string): void => {
		setConfig(cfg);
		setManifestPath(mPath);
	};

	if (config && manifestPath) {
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as LocalManifest;
		return (
			<DevApp
				manifest={manifest}
				port={3001}
				bus={bus}
				watch
				manifestPath={manifestPath}
				repoRoot={config.cdkRoot}
			/>
		);
	}

	return <InitWizard cwd={cwd} bus={bus} onComplete={handleComplete} />;
}

// ── Entry point ──────────────────────────────────────────────────────────────

const { command, args } = parseCliArgs();
const cwd = process.cwd();
const fileConfig = loadConfig(cwd);
const logFilePath = join(cwd, ".cdk-local", "logs", "dev.log");

const bus = new LogBus();
const _logger = new PinoLogger(
	{
		logLevel: fileConfig.logLevel,
		logOutput: fileConfig.logOutput,
		logFilePath,
	},
	bus,
);

if (command === "init") {
	render(<InitApp bus={bus} />);
} else if (command === "dev") {
	const cdkOut = abs(String(args["cdk-out"] ?? "cdk.out"));
	const stack = String(args.stack ?? fileConfig.stack ?? "");
	const stage = String(args.stage ?? fileConfig.stage ?? "dev");
	const port = Number(args.port ?? 3001);
	const watch = args["no-watch"] !== true;
	const repoRoot = args["repo-root"] ? abs(String(args["repo-root"])) : cwd;

	if (!stack) {
		process.stderr.write("[cdk-local] --stack is required\n");
		process.exit(1);
	}

	void extractManifest({
		cdkOut,
		stack,
		stage,
		repoRoot,
		onLog: (e) => bus.emit(e),
		onWarning: (w) => bus.emit({ level: "warn", source: "framework", msg: w }),
	})
		.then((manifest) => {
			render(
				<DevApp manifest={manifest} port={port} bus={bus} watch={watch} repoRoot={repoRoot} />,
			);
		})
		.catch((e: unknown) => {
			process.stderr.write(`[cdk-local] ${e instanceof Error ? e.message : String(e)}\n`);
			process.exit(1);
		});
} else if (command === "serve") {
	const manifestPath = abs(
		String(args.manifest ?? fileConfig.manifestPath ?? ".cdk-local/manifest.json"),
	);
	const port = Number(args.port ?? 3001);
	const watch = args.watch === true;
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as LocalManifest;

	render(
		<DevApp manifest={manifest} port={port} bus={bus} watch={watch} manifestPath={manifestPath} />,
	);
} else if (command === "extract") {
	const cdkOut = abs(String(args["cdk-out"] ?? "cdk.out"));
	const stack = String(args.stack ?? "");
	const stage = String(args.stage ?? "dev");
	const repoRoot = args["repo-root"] ? abs(String(args["repo-root"])) : cwd;

	if (!stack) {
		process.stderr.write("[cdk-local] --stack is required\n");
		process.exit(1);
	}

	render(
		<ExtractApp
			cdkOut={cdkOut}
			stack={stack}
			stage={stage}
			out={args.out as string | undefined}
			synth={Boolean(args.synth)}
			repoRoot={repoRoot}
			bus={bus}
		/>,
	);
} else {
	process.stdout.write(
		"cdk-local — local Lambda dev runner\n\nCommands:\n  init     Interactive setup wizard\n  dev      Extract manifest and start dev server\n  serve    Start server from existing manifest\n  extract  Extract manifest from CDK output\n",
	);
	process.exit(0);
}
