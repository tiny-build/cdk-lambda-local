/** Merges a Lambda's environment variables into `process.env` before invoking its handler. */
export function applyLambdaEnv(env: Readonly<Record<string, string>>): void {
	for (const [k, v] of Object.entries(env)) {
		process.env[k] = v;
	}
}
