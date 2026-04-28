import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

/**
 * Walks up from `start` looking for a `.gitignore`. Returns null if none found
 * before hitting the filesystem root or a `.git` directory boundary.
 */
export function findNearestGitignore(start: string): string | null {
	const { root: fsRoot } = parse(start);
	let current = start;
	while (true) {
		const candidate = join(current, ".gitignore");
		if (existsSync(candidate)) return candidate;
		if (existsSync(join(current, ".git"))) {
			// reached repo root without finding one — stop here
			return null;
		}
		if (current === fsRoot) return null;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/**
 * Adds the given entry to the nearest `.gitignore`, creating one alongside
 * `start` if none exists. No-ops if the entry is already present.
 *
 * Returns the path of the gitignore that was modified or created, or null
 * if no change was needed.
 */
export function addToGitignore(start: string, entry: string): string | null {
	const target = findNearestGitignore(start) ?? join(start, ".gitignore");
	const exists = existsSync(target);
	const current = exists ? readFileSync(target, "utf8") : "";

	const stripped = entry.replace(/\/$/, "").replace(/^\//, "");
	const variants = new Set([entry, stripped, `${stripped}/`, `/${stripped}`, `/${stripped}/`]);
	const lines = current.split("\n").map((l) => l.trim());
	if (lines.some((l) => variants.has(l))) return null;

	const needsLeadingNewline = exists && current.length > 0 && !current.endsWith("\n");
	const next = `${current}${needsLeadingNewline ? "\n" : ""}${entry}\n`;
	writeFileSync(target, next, "utf8");
	return target;
}
