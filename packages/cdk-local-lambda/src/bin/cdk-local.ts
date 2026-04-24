#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Command } from "commander";
import type { Application } from "express";
import { extractManifest } from "../extract/build-manifest";
import { createLocalApp } from "../server/create-app";
import type { LocalManifest } from "../types";

function abs(p: string): string {
	return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function logSuccess(line: string): void {
	if (process.env.NO_COLOR) {
		console.log(line);
		return;
	}
	console.log(`\x1b[32m${line}\x1b[0m`);
}

function listenUntilSignal(opts: {
	app: Application;
	port: number;
	onListening?: () => void;
	onStop: () => Promise<void>;
}): Promise<void> {
	return new Promise((resolve, reject) => {
		const server = opts.app.listen(opts.port, () => {
			opts.onListening?.();
		});
		server.on("error", reject);
		const shutdown = (): void => {
			server.close((err) => {
				opts.onStop().finally(() => (err ? reject(err) : resolve()));
			});
		};
		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);
	});
}

function runSynth(cdkOut: string): Promise<void> {
	return new Promise((resolve, reject) => {
		console.log(`[cdk-local] running cdk synth in ${dirname(cdkOut)}...`);
		const child = spawn("cdk", ["synth", "--output", cdkOut], {
			cwd: dirname(cdkOut),
			stdio: "inherit",
			env: process.env,
			shell: true,
		});
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`cdk synth exited with code ${String(code)}`));
		});
		child.on("error", reject);
	});
}

interface ExtractArgs {
	cdkOut: string;
	stack: string;
	stage: string;
	out?: string;
	synth: boolean;
	repoRoot?: string;
}

async function cmdExtract(opts: ExtractArgs): Promise<void> {
	const cdkOut = abs(opts.cdkOut);
	if (opts.synth) await runSynth(cdkOut);

	const m = await extractManifest({
		cdkOut: cdkOut,
		stack: opts.stack,
		stage: opts.stage,
		repoRoot: opts.repoRoot ? abs(opts.repoRoot) : process.cwd(),
		onWarning: (w) => console.warn(`[cdk-local] ${w}`),
	});
	const json = `${JSON.stringify(m, null, 2)}\n`;
	if (opts.out) {
		const outPath = abs(opts.out);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, json, "utf8");
		logSuccess(
			`[cdk-local] wrote ${outPath} (${Object.keys(m.routes).length} routes, ${Object.keys(m.lambdas).length} lambdas)`,
		);
	} else {
		process.stdout.write(json);
	}
}

interface ServeArgs {
	manifest: string;
	port: string;
	watch: boolean;
}

async function cmdServe(opts: ServeArgs): Promise<void> {
	const manifestPath = abs(opts.manifest);
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as LocalManifest;
	const handle = await createLocalApp({
		manifest,
		manifestPath,
		watch: opts.watch,
		onReload: (p, n) => console.error(`[cdk-local] reload (${n} cached) after ${p}`),
		onManifestChange: (p) =>
			console.error(
				`[cdk-local] manifest changed (${p}); restart the process to apply route topology changes`,
			),
	});
	const port = Number(opts.port);
	await listenUntilSignal({
		app: handle.app,
		port,
		onListening: () =>
			logSuccess(
				`[cdk-local] listening on http://localhost:${port} (${handle.routes.length} routes)`,
			),
		onStop: () => handle.stop(),
	});
}

interface DevArgs {
	cdkOut: string;
	stack: string;
	stage: string;
	port: string;
	watch: boolean;
	repoRoot?: string;
}

async function cmdDev(opts: DevArgs): Promise<void> {
	const repoRoot = opts.repoRoot ? abs(opts.repoRoot) : process.cwd();
	const manifest = await extractManifest({
		cdkOut: abs(opts.cdkOut),
		stack: opts.stack,
		stage: opts.stage,
		repoRoot,
		onWarning: (w) => console.warn(`[cdk-local] ${w}`),
	});
	const handle = await createLocalApp({
		manifest,
		repoRoot,
		watch: opts.watch,
		onReload: (p, n) => console.error(`[cdk-local] reload (${n} cached) after ${p}`),
	});
	const port = Number(opts.port);
	await listenUntilSignal({
		app: handle.app,
		port,
		onListening: () => logSuccess(`[cdk-local] dev listening on http://localhost:${port}`),
		onStop: () => handle.stop(),
	});
}

const program = new Command();
program.name("cdk-local").description("Synth-driven local Lambda dev runner");

program
	.command("extract")
	.requiredOption("--cdk-out <dir>", "path to cdk.out")
	.requiredOption("--stack <name>", "CloudFormation stack name")
	.requiredOption("--stage <env>", "deployment stage (e.g. dev)")
	.option("--out <file>", "output manifest path (default: stdout)")
	.option("--synth", "run cdk synth before extracting", false)
	.option("--repo-root <dir>", "repo root for resolving handler source paths (default: cwd)")
	.action(cmdExtract);

program
	.command("serve")
	.requiredOption("--manifest <file>", "path to a v2 manifest")
	.option("--port <n>", "port", "3001")
	.option("--watch", "enable file watching", false)
	.action((o: { manifest: string; port: string; watch?: boolean }) =>
		cmdServe({ ...o, watch: o.watch === true }),
	);

program
	.command("dev")
	.requiredOption("--cdk-out <dir>", "path to cdk.out")
	.requiredOption("--stack <name>", "CloudFormation stack name")
	.requiredOption("--stage <env>", "deployment stage")
	.option("--port <n>", "port", "3001")
	.option("--no-watch", "disable file watching")
	.option("--repo-root <dir>", "repo root for resolving handler source paths (default: cwd)")
	.action(
		(o: {
			cdkOut: string;
			stack: string;
			stage: string;
			port: string;
			watch?: boolean;
			repoRoot?: string;
		}) => cmdDev({ ...o, watch: o.watch !== false }),
	);

program.parseAsync(process.argv).catch((err) => {
	console.error(err);
	process.exit(1);
});
