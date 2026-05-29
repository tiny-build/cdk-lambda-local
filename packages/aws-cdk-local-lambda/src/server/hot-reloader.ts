import type { ModuleLoader } from './module-loader';

import chokidar, { type FSWatcher } from 'chokidar';
import { normalize } from 'node:path';

import { WATCHER_IGNORED_PATTERNS } from '../constants/watcher';

/** Options for {@link startWatcher}. */
export interface StartWatcherOptions {
  /** Directories or files to watch for changes. */
  readonly paths: readonly string[];
  /** Module loader whose cache is invalidated when a watched file changes. */
  readonly loader: ModuleLoader;
  /** Called after handler modules are invalidated due to a file change. */
  readonly onReload?: (changedPath: string, invalidatedCount: number) => void;
  /** Called when the manifest file itself changes (requires `manifestPath`). */
  readonly onManifestChange?: (path: string) => void;
  /** Absolute path to the manifest file to watch alongside source files. */
  readonly manifestPath?: string;
  /** Debounce window in milliseconds before processing a batch of changes. Defaults to `100`. */
  readonly debounceMs?: number;
  /** Called with verbose framework log lines. Pass `() => {}` to silence them. */
  readonly onFrameworkLog?: (message: string) => void;
}

/**
 * Starts a file watcher that invalidates the {@link ModuleLoader} cache when source files change.
 *
 * Returns an async stop function that closes the watcher and cancels any pending debounce timers.
 */
export async function startWatcher(
  opts: StartWatcherOptions
): Promise<() => Promise<void>> {
  const watchTargets = [...opts.paths];
  if (opts.manifestPath) watchTargets.push(opts.manifestPath);

  const manifestNorm = opts.manifestPath ? normalize(opts.manifestPath) : null;

  const watcher: FSWatcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    ignored: (path: string) => {
      if (manifestNorm && normalize(path) === manifestNorm) return false;
      return WATCHER_IGNORED_PATTERNS.some(re => re.test(path));
    }
  });

  let timer: NodeJS.Timeout | null = null;
  const batch: string[] = [];
  const debounceMs = opts.debounceMs ?? 100;

  const fire = (): void => {
    timer = null;
    const paths = batch.splice(0, batch.length);
    if (paths.length === 0) return;
    if (manifestNorm) {
      const manifestHit = paths.find(p => normalize(p) === manifestNorm);
      if (manifestHit) {
        opts.onManifestChange?.(manifestHit);
        return;
      }
    }
    const p = paths[paths.length - 1]!;
    const n = opts.loader.invalidate(p);
    opts.onReload?.(p, n);
  };

  watcher.on('all', (_event, p) => {
    batch.push(p);
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
