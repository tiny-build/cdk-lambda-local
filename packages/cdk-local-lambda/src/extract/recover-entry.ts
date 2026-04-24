import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve, join } from 'node:path';

import { ENTRY_MARKER_RE } from '../constants/recover-entry';

export interface RecoverEntryOptions {
  readonly assetDir: string;
  readonly repoRoot: string;
  readonly onWarning?: (message: string) => void;
}

export function recoverEntry(opts: RecoverEntryOptions): string {
  const indexPath = join(opts.assetDir, 'index.js');
  const fallback = indexPath;

  let body: string;
  try {
    body = readFileSync(indexPath, 'utf8');
    console.log(`[cdk-local] attempting to recover entry for ${indexPath}...`);
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
