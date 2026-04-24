export interface AuthorizerDecision {
	readonly allow: boolean;
	readonly context?: Readonly<Record<string, string>>;
}

interface PolicyLike {
	readonly policyDocument?: {
		readonly Statement?: ReadonlyArray<{ readonly Effect?: string }>;
	};
	readonly context?: Readonly<Record<string, unknown>>;
}

export function isAuthorizerAllow(result: unknown): AuthorizerDecision {
	if (!result || typeof result !== "object") return { allow: false };
	const r = result as PolicyLike;
	const statements = r.policyDocument?.Statement ?? [];
	let sawAllow = false;
	for (const s of statements) {
		if (s?.Effect === "Deny") return { allow: false };
		if (s?.Effect === "Allow") sawAllow = true;
	}
	if (!sawAllow) return { allow: false };
	const ctx: Record<string, string> = {};
	if (r.context) {
		for (const [k, v] of Object.entries(r.context)) {
			ctx[k] = typeof v === "string" ? v : JSON.stringify(v);
		}
	}
	return { allow: true, context: ctx };
}
