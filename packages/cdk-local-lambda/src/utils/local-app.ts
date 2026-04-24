import type { LocalLambda, LocalManifest, LocalRoute } from '../types';

import { dirname } from 'node:path';

type RouteEntry = [string, LocalRoute];

export function inferRepoRootFromManifest(
  manifest: Pick<LocalManifest, 'cdkOut'>
): string {
  if (/\/(infra\/)?cdk\.out$/.test(manifest.cdkOut.replace(/\\/g, '/'))) {
    return dirname(dirname(manifest.cdkOut));
  }
  return process.cwd();
}

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
