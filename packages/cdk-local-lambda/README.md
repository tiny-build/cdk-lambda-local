# @pat/cdk-local-lambda

Run CDK API Gateway + Lambda apps locally over HTTP, driven entirely by `cdk synth` output. No handler registry required.

## How it works

1. CDK synthesizes your stacks into `cdk.out/`.
2. `cdk-local extract` parses `cdk.out/<Stack>.template.json` + `<Stack>.assets.json` into a self-contained `LocalManifest`: routes, lambdas, per-route authorizer, and each Lambda's recovered TypeScript entry path (derived from esbuild's bundle markers).
3. `cdk-local serve` (or the programmatic `createLocalApp`) boots an Express app that registers all routes, invokes authorizers per-route, and hot-reloads handlers on save via chokidar + handler cache invalidation (see Hot reload below).

## Install

Workspace-internal for now:

```json
"dependencies": { "@pat/cdk-local-lambda": "workspace:*" }
```

## CLI

```
cdk-local extract --cdk-out <dir> --stack <name> --stage <env> [--out <file>] [--synth]
cdk-local serve   --manifest <file> [--port 3001] [--watch]
cdk-local dev     --cdk-out <dir> --stack <name> --stage <env> [--port 3001] [--no-watch]
```

- `extract` writes a v2 `LocalManifest` JSON to `--out` (or stdout if omitted). Pass `--synth` to run `cdk synth` first (useful after cloning to a new path, since esbuild embeds absolute source paths in bundles).
- `serve` reads a pre-extracted manifest and starts the server. File watching is **opt-in** (`--watch`).
- `dev` = `extract` + `serve` in one step. File watching is **on** by default (`--no-watch` to disable).

## Programmatic

```typescript
import { extractManifest } from '@pat/cdk-local-lambda/extract';
import { createLocalApp } from '@pat/cdk-local-lambda/server';

const manifest = await extractManifest({
  cdkOut: 'infra/cdk.out',
  stack: 'PatBackendStack',
  stage: 'dev'
});

const { app, routes, stop } = await createLocalApp({
  manifest,
  watch: true,
  onReload: (path, count) => console.log(`reloaded (${count}) after ${path}`)
});

app.listen(3001);
```

## Running your handlers

Run the consumer process with `tsx` (or equivalent) so dynamic `import()` of `.ts` entries works:

```
pnpm exec tsx api/scripts/serve-local.ts
```

## Hot reload

On any file change under the watched paths (default: derived from each Lambda's manifest `entry`, walked up to the nearest `src/` ancestor; recovery from bundle markers happens at `extract` time only), the loader invalidates its handler cache. For `.ts`/`.tsx` entries under a standard `api/` tree, the next load **esbuild-bundles** the handler into a short-lived file under `node_modules/.cache/cdk-local-lambda/` at the monorepo root and imports that bundle, so you always run code that matches the files on disk (tsx’s own transform cache is not used on that path). Other entry types still use dynamic `import()` with a cache-busting query. No process restart.

## Route specificity

Literal routes win over parameterized routes at the same depth. For example, if both `/users/me` and `/users/{id}` are registered, `GET /users/me` matches the literal handler, while `GET /users/42` falls through to the parameterized one — matching API Gateway's behavior.

## What this package does NOT do

- Load `.env` files or set `AWS_REGION` defaults (consumer's job).
- Call `app.listen` from `createLocalApp` (consumer owns the port and lifecycle).
- Know about any repo-specific naming conventions (function prefixes, authorizer keys, etc).

## License

MIT.
