/** Callback for non-fatal warning messages during manifest extraction. */
export type WarningLogger = (message: string) => void;

/**
 * Extracts the exported function name from a Lambda `Handler` property.
 *
 * @example `"index.handler"` → `"handler"`, `"handler"` → `"handler"`
 */
export function splitHandler(handlerProp: unknown): string {
  if (typeof handlerProp !== 'string') return 'handler';
  const idx = handlerProp.lastIndexOf('.');
  return idx === -1 ? handlerProp : handlerProp.slice(idx + 1);
}

/**
 * Strips the `-<stage>-` infix from a Lambda function name to produce a stable key.
 *
 * @example `stageKey("MyStack-prod-MyFn", "prod")` → `"MyFn"`
 */
export function stageKey(
  functionName: string,
  stage: string | undefined
): string {
  if (!stage) return functionName;
  const needle = `-${stage}-`;
  const idx = functionName.indexOf(needle);
  if (idx === -1) return functionName;
  return functionName.slice(idx + needle.length);
}

/** Normalises a raw CloudFormation `Environment.Variables` object to `Record<string, string>`, stringifying any non-string values. */
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
