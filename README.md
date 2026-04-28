<div align="center">

<img src="readme-assets/cdk-local.png" alt="cdk-lambda-local" width="180" />

# cdk-lambda-local

**Run your CDK API Gateway + Lambda stack locally over HTTP — no mocks, no handler registry.**
Reads `cdk synth` output directly and boots a local Express server that mirrors your deployed routes, with hot reload.

[![CI](https://img.shields.io/github/actions/workflow/status/tiny-build/cdk-lambda-local/release.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI&labelColor=7fc5e1&color=fed11e)](https://github.com/tiny-build/cdk-lambda-local/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/cdk-lambda-local?style=for-the-badge&logo=npm&logoColor=white&label=npm&labelColor=7fc5e1&color=f99933)](https://www.npmjs.com/package/cdk-lambda-local)
[![npm downloads](https://img.shields.io/npm/dm/cdk-lambda-local?style=for-the-badge&logo=npm&logoColor=white&label=downloads&labelColor=7fc5e1&color=fed11e)](https://www.npmjs.com/package/cdk-lambda-local)
[![GitHub stars](https://img.shields.io/github/stars/tiny-build/cdk-lambda-local?style=for-the-badge&logo=github&logoColor=white&labelColor=7fc5e1&color=f99933)](https://github.com/tiny-build/cdk-lambda-local/stargazers)

### Built with

![TypeScript](https://img.shields.io/badge/TypeScript-7fc5e1?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_22+-7fc5e1?style=for-the-badge&logo=nodedotjs&logoColor=white)
![AWS CDK](https://img.shields.io/badge/AWS_CDK-f99933?style=for-the-badge&logo=amazonaws&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-f99933?style=for-the-badge&logo=awslambda&logoColor=white)
![Express](https://img.shields.io/badge/Express-7fc5e1?style=for-the-badge&logo=express&logoColor=white)
![esbuild](https://img.shields.io/badge/esbuild-fed11e?style=for-the-badge&logo=esbuild&logoColor=black)
![Pino](https://img.shields.io/badge/Pino-7fc5e1?style=for-the-badge&logo=pino&logoColor=white)
![Ink](https://img.shields.io/badge/Ink-7fc5e1?style=for-the-badge&logo=react&logoColor=white)
![Nx](https://img.shields.io/badge/Nx-f99933?style=for-the-badge&logo=nx&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-fed11e?style=for-the-badge&logo=pnpm&logoColor=black)
![Biome](https://img.shields.io/badge/Biome-7fc5e1?style=for-the-badge&logo=biome&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-fed11e?style=for-the-badge&logo=vitest&logoColor=black)

</div>

---

## Why this exists

Iterating on a CDK-deployed API usually means waiting for `cdk deploy`, or wiring up SAM/LocalStack with a handler registry that drifts from your real stack. `cdk-lambda-local` skips all of that:

- **Reads `cdk synth` directly** — your stack template is the source of truth.
- **Real Express server** — no mocks, no registry, no fake invoke.
- **Hot reload** — handlers re-bundle on save, no process restart.
- **Authorizers per route** — invoked exactly like API Gateway does.

## Install

```bash
npm install cdk-lambda-local
```
or
```bash
pnpm add cdk-lambda-local
```

## Quickstart

> [!TIP]
> **First time?** Just run `npx cdk-local init` from your CDK project root. The interactive wizard handles install, `cdk synth`, manifest extraction, and starts the dev server — all in one flow.

```bash
npx cdk-local init
```

The wizard will:

1. **Auto-detect** your CDK app (looks for `cdk.json` + `aws-cdk-lib`).
2. **List stacks** via `cdk ls` and let you pick one.
3. **Prompt** for stage, log level, and log output (stdout vs file).
4. **Install** `cdk-lambda-local` as a dev dependency using your detected package manager (npm / pnpm / yarn / bun).
5. **Run `cdk synth`** and extract the manifest to `.cdk-local/manifest.json`.
6. **Persist** your choices to `.cdk-local/config.json` and add `.cdk-local/` to `.gitignore`.
7. **Boot** the local server on port `3001` with hot reload.

> [!NOTE]
> After `init`, subsequent runs only need `npx cdk-local dev` (or `serve` if your routes haven't changed) — your config is read from `.cdk-local/config.json`.

## CLI reference

If you'd rather wire things up manually, the lower-level commands are available too:

```bash
# All-in-one: extract + serve (uses .cdk-local/config.json if present)
npx cdk-local dev --stack MyStack --stage dev --port 3001

# Step 1 — parse cdk.out into a manifest file
npx cdk-local extract --cdk-out cdk.out --stack MyStack --stage dev --out .cdk-local/manifest.json

# Step 2 — start the local server from that manifest
npx cdk-local serve --manifest .cdk-local/manifest.json --port 3001 --watch
```

**When to keep them separate:** if your handlers don't change between runs, reuse the same manifest and skip re-running `cdk synth`. Only re-extract when you add or rename a handler — the server hot-reloads handler code on save.

| Command   | Purpose                                                              | Watch default                |
|-----------|----------------------------------------------------------------------|------------------------------|
| `init`    | Interactive wizard: install + `cdk synth` + extract + serve          | on                           |
| `dev`     | `extract` + `serve` in one step                                      | on (`--no-watch` to disable) |
| `extract` | Parse `cdk.out` → `LocalManifest` JSON (pass `--synth` to run synth) | n/a                          |
| `serve`   | Boot Express from a pre-built manifest                               | opt-in (`--watch`)           |

> [!IMPORTANT]
> `init` requires the AWS CDK CLI on your `PATH` (it shells out to `cdk ls` and `cdk synth`). If you don't have it globally, install it with `npm i -g aws-cdk` or run inside a project where `cdk` is available via `npx`.

## Programmatic usage

```ts
import { extractManifest } from "cdk-lambda-local/extract";
import { createLocalApp } from "cdk-lambda-local/server";

const manifest = await extractManifest({
  cdkOut: "cdk.out",
  stack: "MyStack",
  stage: "dev",
});

const { app, routes, stop } = await createLocalApp({
  manifest,
  watch: true,
  onReload: (path, count) => console.log(`reloaded (${count}) after ${path}`),
});

app.listen(3001);
```

> Run the consumer process with `tsx` (or equivalent) so dynamic `import()` of `.ts` entries works.

## Repository layout

```
cdk-lambda-local/
├── packages/
│   └── cdk-lambda-local/   # the published package
├── examples/
│   └── simple-crud/        # end-to-end example stack
├── .github/workflows/      # CI + release (Changesets + npm trusted publishing)
└── README.md
```

This is an [Nx](https://nx.dev) monorepo managed with [pnpm](https://pnpm.io) workspaces and released via [Changesets](https://github.com/changesets/changesets).

## Contributing

Contributions are welcome — small PRs, clear commits, conventional commits enforced.

- [CONTRIBUTING.md](CONTRIBUTING.md) — pull request workflow and expectations

## License

[MIT](LICENSE) © tiny-build
