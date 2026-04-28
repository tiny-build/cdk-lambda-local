export function sortRecord<T>(record: Record<string, T>): Record<string, T> {
	const out: Record<string, T> = {};
	for (const key of Object.keys(record).sort()) {
		out[key] = record[key]!;
	}
	return out;
}
