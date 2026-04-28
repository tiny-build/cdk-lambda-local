import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const PACKAGE = "cdk-local-lambda";
const BUMP_TYPES = ["patch", "minor", "major"];

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const bumpType = process.argv[2];

async function main() {
	let bump = bumpType;

	if (!bump || !BUMP_TYPES.includes(bump)) {
		console.log(`Releasing: ${PACKAGE}`);
		console.log("Bump type: patch | minor | major (default: patch)");
		const answer = (await ask("Bump type [patch]: ")).trim().toLowerCase();
		bump = BUMP_TYPES.includes(answer) ? answer : "patch";
	}

	rl.close();

	const summary = await new Promise((resolve) => {
		const r = createInterface({ input: process.stdin, output: process.stdout });
		r.question("Summary (leave blank to open editor): ", (ans) => {
			r.close();
			resolve(ans.trim());
		});
	});

	const name = randomBytes(8).toString("hex");
	const file = `.changeset/${name}.md`;
	const content = `---\n"${PACKAGE}": ${bump}\n---\n\n${summary}\n`;

	writeFileSync(file, content);

	if (!summary) {
		const editor = process.env.EDITOR || "vi";
		execSync(`${editor} ${file}`, { stdio: "inherit" });
	}

	console.log(`\nCreated changeset: ${file}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
