export type WarningLogger = (message: string) => void;

export function splitHandler(handlerProp: unknown): string {
  if (typeof handlerProp !== 'string') return 'handler';
  const idx = handlerProp.lastIndexOf('.');
  return idx === -1 ? handlerProp : handlerProp.slice(idx + 1);
}

export function stageKey(functionName: string, stage: string): string {
  const needle = `-${stage}-`;
  const idx = functionName.indexOf(needle);
  if (idx === -1) return functionName;
  return functionName.slice(idx + needle.length);
}

export function normalizeEnv(
  raw: unknown,
  onWarning: WarningLogger | undefined,
  logicalId: string
): Readonly<Record<string, string>> {
  if (!raw || typeof raw !== 'object') return {};

  const obj = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      out[key] = value;
      continue;
    }
    onWarning?.(
      `extractManifest: ${logicalId} env var "${key}" is not a string; stringifying.`
    );
    out[key] = JSON.stringify(value);
  }
  return out;
}
