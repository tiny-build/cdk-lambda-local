import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { ENTRY_MARKER_RE } from '../constants/recover-entry';

/** Options for {@link recoverEntry}. */
export interface RecoverEntryOptions {
  /** Absolute path to the CDK asset directory containing the bundled `index.js`. */
  readonly assetDir: string;
  /** Repository root used to resolve relative source paths found in the bundle. */
  readonly repoRoot: string;
  /** Called with non-fatal warnings when the entry file cannot be determined. */
  readonly onWarning?: (message: string) => void;
  /** Called with verbose framework log lines. */
  readonly onFrameworkLog?: (message: string) => void;
}

/**
 * Attempts to recover the original TypeScript entry file path from a CDK-bundled `index.js`.
 *
 * CDK embeds source-map markers in bundles. This function reads them and resolves the first
 * marker that points to an existing file on disk. Falls back to `index.js` if none is found.
 */
export function recoverEntry(opts: RecoverEntryOptions): string {
  const indexPath = join(opts.assetDir, 'index.js');
  const fallback = indexPath;
  const log = opts.onFrameworkLog ?? console.error;

  let body: string;
  try {
    body = readFileSync(indexPath, 'utf8');
    log(`[cdk-local] attempting to recover entry for ${indexPath}...`);
  } catch {
    opts.onWarning?.(
      `recover-entry: could not read ${indexPath}; falling back to itself.`
    );
    return fallback;
  }

  const matches: string[] = [];
  for (const m of body.matchAll(ENTRY_MARKER_RE)) {
    const p = m[1];
    if (!p) continue;
    if (p.includes('/node_modules/')) continue;
    matches.push(p);
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const raw = matches[i]!;
    const abs = isAbsolute(raw) ? raw : resolve(opts.repoRoot, raw);
    if (existsSync(abs)) return abs;
  }

  opts.onWarning?.(
    `recover-entry: no non-node_modules TS marker in ${indexPath} matched an existing file on disk; falling back to index.js.`
  );
  return fallback;
}
