import type { Request } from 'express';

/** Converts Express request headers to a flat `Record<string, string>` with lower-cased keys, joining multi-value headers with `","`. */
export function lowerCaseHeaderMap(
  headers: Request['headers']
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const normalized = Array.isArray(value) ? value.join(',') : value;
    out[key.toLowerCase()] = normalized;
  }
  return out;
}

/** Extracts query string parameters from an Express request as a flat string map, or `null` if there are none. */
export function queryFromRequest(req: Request): Record<string, string> | null {
  const qs = req.query as Record<string, string | string[] | undefined>;
  const entries = Object.entries(qs);
  if (entries.length === 0) return null;

  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(',') : String(value);
  }
  return out;
}

/** Extracts Express path parameters (e.g. `:id`) as a flat string map, or `null` if there are none. */
export function pathParamsFromRequest(
  req: Request
): Record<string, string> | null {
  const params = (req.params ?? {}) as Record<string, string | undefined>;
  const entries = Object.entries(params);
  if (entries.length === 0) return null;

  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    out[key] = String(value);
  }
  return Object.keys(out).length === 0 ? null : out;
}
