import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function findNearestNamedFile(
  fromAbsFile: string,
  fileName: string
): string | undefined {
  let dir = dirname(fromAbsFile);
  for (;;) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function findAncestorWithNodeModules(
  fromAbsFile: string
): string | undefined {
  let dir = dirname(fromAbsFile);
  for (;;) {
    if (existsSync(join(dir, 'node_modules'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
