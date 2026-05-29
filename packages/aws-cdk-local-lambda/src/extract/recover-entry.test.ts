import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { recoverEntry } from './recover-entry';

function makeAsset(indexJs: string, fsLayout: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'recover-entry-'));
  const assetDir = join(root, 'asset.x');
  mkdirSync(assetDir);
  writeFileSync(join(assetDir, 'index.js'), indexJs);
  for (const [rel, contents] of Object.entries(fsLayout)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents);
  }
  return { root, assetDir };
}

describe('recoverEntry', () => {
  it('returns the last non-node_modules TS marker that exists on disk', () => {
    const indexJs = [
      '// node_modules/foo/index.js',
      'exports.foo = 1;',
      '// api/src/libs/logger.ts',
      'var logger = {};',
      '// api/src/functions/hello/handler.ts',
      'exports.main = async () => {};'
    ].join('\n');
    const { root, assetDir } = makeAsset(indexJs, {
      'api/src/functions/hello/handler.ts': 'export const main = () => {};'
    });
    const got = recoverEntry({ assetDir, repoRoot: root });
    expect(got).toBe(join(root, 'api/src/functions/hello/handler.ts'));
  });

  it('accepts tsx/mts/cts/js/mjs/cjs extensions', () => {
    const indexJs = '// src/foo.mts\nexport {};';
    const { root, assetDir } = makeAsset(indexJs, { 'src/foo.mts': 'x' });
    const got = recoverEntry({ assetDir, repoRoot: root });
    expect(got).toBe(join(root, 'src/foo.mts'));
  });

  it('falls back to index.js when no marker matches a file on disk', () => {
    const warnings: string[] = [];
    const indexJs = '// src/missing.ts\nexports.x = 1;';
    const { assetDir } = makeAsset(indexJs, {});
    const got = recoverEntry({
      assetDir,
      repoRoot: '/tmp',
      onWarning: w => warnings.push(w)
    });
    expect(got).toBe(join(assetDir, 'index.js'));
    expect(warnings.length).toBe(1);
  });

  it('falls back to index.js when index.js has no marker at all', () => {
    const { assetDir } = makeAsset('exports.x = 1;', {});
    const got = recoverEntry({ assetDir, repoRoot: '/tmp' });
    expect(got).toBe(join(assetDir, 'index.js'));
  });
});
