export function applyLambdaEnv(env: Readonly<Record<string, string>>): void {
	for (const [k, v] of Object.entries(env)) {
		process.env[k] = v;
	}
}
