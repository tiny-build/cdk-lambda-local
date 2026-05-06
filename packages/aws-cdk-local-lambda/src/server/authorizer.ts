/** Result of evaluating a Lambda authorizer response. */
export interface AuthorizerDecision {
  /** `true` if the authorizer granted access, `false` to short-circuit with a 403. */
  readonly allow: boolean;
  /** Key/value context propagated to the downstream Lambda via `requestContext.authorizer`. */
  readonly context?: Readonly<Record<string, string>>;
}

interface PolicyLike {
  readonly policyDocument?: {
    readonly Statement?: ReadonlyArray<{ readonly Effect?: string }>;
  };
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Evaluates the raw return value from a Lambda authorizer and returns an {@link AuthorizerDecision}.
 *
 * The result is allowed only when the policy document contains at least one `"Allow"` statement
 * and no `"Deny"` statements. Any `context` values are coerced to strings.
 */
export function isAuthorizerAllow(result: unknown): AuthorizerDecision {
  if (!result || typeof result !== 'object') return { allow: false };
  const r = result as PolicyLike;
  const statements = r.policyDocument?.Statement ?? [];
  let sawAllow = false;
  for (const s of statements) {
    if (s?.Effect === 'Deny') return { allow: false };
    if (s?.Effect === 'Allow') sawAllow = true;
  }
  if (!sawAllow) return { allow: false };
  const ctx: Record<string, string> = {};
  if (r.context) {
    for (const [k, v] of Object.entries(r.context)) {
      ctx[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }
  return { allow: true, context: ctx };
}
