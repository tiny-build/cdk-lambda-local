# @tiny-build/cdk-local-lambda

Run your CDK API Gateway + Lambda stack locally over HTTP — no mocks, no handler registry. It reads the output of `cdk synth` directly and boots a local Express server that mirrors your deployed routes.

This repository is an Nx monorepo containing the published package `@tiny-build/cdk-local-lambda`.

## How it works

1. `cdk synth` produces `cdk.out/` with your stack template and asset manifest.
2. `cdk-local extract` parses that output into a self-contained manifest: routes, Lambda handlers, per-route authorizers, and each Lambda's TypeScript entry path.
3. `cdk-local serve` boots an Express server from the manifest, registers all routes, invokes authorizers per-request, and **hot-reloads** handlers on file save — no restart needed.

## Install

```bash
npm install @tiny-build/cdk-local-lambda
```

## Quickstart

The simplest way to get running is the `dev` command, which runs extract + serve in one step:

```bash
npx cdk-local dev --cdk-out cdk.out --stack MyStack --stage dev --port 3001
```

## CLI reference

You can also run the two steps separately if you want more control:

```bash
# Step 1: parse cdk.out into a manifest file
npx cdk-local extract --cdk-out cdk.out --stack MyStack --stage dev --out .local/manifest.json

# Step 2: start the local server from that manifest
npx cdk-local serve --manifest .local/manifest.json --port 3001 --watch
```

**When to keep them separate:** if your Lambda handlers don't change between runs, you can reuse the same manifest and skip re-running `cdk synth`. Only re-extract when you add or rename a handler. The server hot-reloads handler code on save, so you don't need to restart for code changes.

## Programmatic usage

```ts
import { extractManifest } from "@tiny-build/cdk-local-lambda/extract";
import { createLocalApp } from "@tiny-build/cdk-local-lambda/server";

const manifest = await extractManifest({
  cdkOut: "cdk.out",
  stack: "MyStack",
  stage: "dev",
});

const { app, stop } = await createLocalApp({ manifest, watch: true });
app.listen(3001);
```

## Package docs

Full API reference, hot-reload details, and route specificity behaviour live in the package README:

- [packages/cdk-local-lambda/README.md](packages/cdk-local-lambda/README.md)

## Contributing

- [CONTRIBUTING.md](CONTRIBUTING.md) — pull request workflow and expectations
- [DEVELOPMENT.md](DEVELOPMENT.md) — local setup, changesets, and release flow

## License

MIT
