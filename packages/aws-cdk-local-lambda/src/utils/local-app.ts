import type { LocalLambda, LocalManifest, LocalRoute } from '../types';

import { dirname } from 'node:path';

type RouteEntry = [string, LocalRoute];

/**
 * Infers the repository root from a manifest by walking up from `cdkOut`.
 * Assumes the conventional layout where `cdk.out` lives at `<repo>/cdk.out` or `<repo>/infra/cdk.out`.
 */
export function inferRepoRootFromManifest(
  manifest: Pick<LocalManifest, 'cdkOut'>
): string {
  if (/\/(infra\/)?cdk\.out$/.test(manifest.cdkOut.replace(/\\/g, '/'))) {
    return dirname(dirname(manifest.cdkOut));
  }
  return process.cwd();
}

/**
 * Returns the set of directories to watch for hot-reloading, derived from each Lambda's entry path.
 * Resolves to the nearest `src/` ancestor directory, falling back to the entry's parent directory.
 */
export function defaultWatchPaths(
  lambdas: Readonly<Record<string, LocalLambda>>
): string[] {
  const set = new Set<string>();
  for (const lambda of Object.values(lambdas)) {
    const source = lambda.entry;
    const parts = source.split(/[\\/]/);
    const idx = parts.lastIndexOf('src');
    if (idx > 0) {
      set.add(parts.slice(0, idx + 1).join('/'));
    } else {
      set.add(dirname(source));
    }
  }
  return [...set];
}

/**
 * Sorts routes so more-specific paths are registered before less-specific ones.
 * Routes with fewer path parameter placeholders come first; ties are broken by descending path length.
 */
export function sortRoutesBySpecificity(
  routes: Readonly<Record<string, LocalRoute>>
): RouteEntry[] {
  return Object.entries(routes).sort(([, a], [, b]) => {
    const score = (path: string): [number, number] => [
      (path.match(/\{[^}]+\}/g) ?? []).length,
      -path.length
    ];
    const [pa, la] = score(a.path);
    const [pb, lb] = score(b.path);
    return pa - pb || la - lb;
  });
}
