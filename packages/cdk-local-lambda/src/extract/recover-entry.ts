import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, parse, resolve } from "node:path";

import { ENTRY_MARKER_RE } from "../constants/recover-entry";
import type { LogEntry } from "../logger/log-bus";

export interface RecoverEntryOptions {
	readonly assetDir: string;
	readonly repoRoot: string;
	readonly onWarning?: (message: string) => void;
	readonly onLog?: (entry: Omit<LogEntry, "time">) => void;
}

function candidateRoots(repoRoot: string): string[] {
	const roots: string[] = [];
	const { root: fsRoot } = parse(repoRoot);
	let current = repoRoot;
	while (true) {
		roots.push(current);
		if (current === fsRoot) break;
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return roots;
}

function resolveRelative(raw: string, repoRoot: string): string | null {
	if (isAbsolute(raw)) {
		return existsSync(raw) ? raw : null;
	}
	for (const root of candidateRoots(repoRoot)) {
		const abs = resolve(root, raw);
		if (existsSync(abs)) return abs;
	}
	return null;
}

export function recoverEntry(opts: RecoverEntryOptions): string {
	const indexPath = resolve(opts.assetDir, "index.js");
	const fallback = indexPath;

	let body: string;
	try {
		body = readFileSync(indexPath, "utf8");
		opts.onLog?.({
			level: "debug",
			source: "framework",
			msg: `attempting to recover entry for ${indexPath}`,
		});
	} catch {
		opts.onWarning?.(`recover-entry: could not read ${indexPath}; falling back to itself.`);
		return fallback;
	}

	const matches: string[] = [];
	for (const m of body.matchAll(ENTRY_MARKER_RE)) {
		const p = m[1];
		if (!p) continue;
		if (p.includes("/node_modules/")) continue;
		matches.push(p);
	}

	for (let i = matches.length - 1; i >= 0; i--) {
		const raw = matches[i]!;
		const found = resolveRelative(raw, opts.repoRoot);
		if (found) return found;
	}

	opts.onWarning?.(
		`recover-entry: no non-node_modules TS marker in ${indexPath} matched an existing file on disk; falling back to index.js.`,
	);
	return fallback;
}
