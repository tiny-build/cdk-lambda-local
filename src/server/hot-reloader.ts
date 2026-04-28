import { normalize } from "node:path";

import chokidar, { type FSWatcher } from "chokidar";
import { WATCHER_IGNORED_PATTERNS } from "../constants/watcher.js";
import type { LogEntry } from "../logger/log-bus.js";
import type { ModuleLoader } from "./module-loader.js";

export interface StartWatcherOptions {
	readonly paths: readonly string[];
	readonly loader: ModuleLoader;
	readonly onReload?: (changedPath: string, invalidatedCount: number) => void;
	readonly onManifestChange?: (path: string) => void;
	readonly manifestPath?: string;
	readonly debounceMs?: number;
	readonly onLog?: (entry: Omit<LogEntry, "time">) => void;
}

export async function startWatcher(opts: StartWatcherOptions): Promise<() => Promise<void>> {
	const watchTargets = [...opts.paths];
	if (opts.manifestPath) watchTargets.push(opts.manifestPath);

	const manifestNorm = opts.manifestPath ? normalize(opts.manifestPath) : null;

	const watcher: FSWatcher = chokidar.watch(watchTargets, {
		ignoreInitial: true,
		ignored: (path: string) => {
			if (manifestNorm && normalize(path) === manifestNorm) return false;
			return WATCHER_IGNORED_PATTERNS.some((re) => re.test(path));
		},
	});

	let timer: NodeJS.Timeout | null = null;
	let lastPath = "";
	const debounceMs = opts.debounceMs ?? 100;

	const fire = (): void => {
		timer = null;
		if (manifestNorm && normalize(lastPath) === manifestNorm) {
			opts.onManifestChange?.(lastPath);
			return;
		}
		const n = opts.loader.invalidate(lastPath);
		opts.onReload?.(lastPath, n);
	};

	watcher.on("all", (_event, p) => {
		lastPath = p;
		opts.onLog?.({
			level: "debug",
			source: "framework",
			msg: `file change detected: ${p} (event: ${_event})`,
		});
		if (timer) clearTimeout(timer);
		timer = setTimeout(fire, debounceMs);
	});

	let stopped = false;
	return async () => {
		if (stopped) return;
		stopped = true;
		if (timer) clearTimeout(timer);
		await watcher.close();
	};
}
