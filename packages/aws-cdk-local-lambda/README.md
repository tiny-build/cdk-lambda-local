<div align="center">

<img src="https://raw.githubusercontent.com/tiny-build/aws-cdk-local-lambda/main/readme-assets/cdk-local.png" alt="aws-cdk-local-lambda" width="180" />

# aws-cdk-local-lambda

**Run an API Gateway + Lambda app locally over HTTP, driven entirely by `cdk synth` output.**
No handler registry. No mocks. Hot reload on save.

[![CI](https://img.shields.io/github/actions/workflow/status/tiny-build/aws-cdk-local-lambda/release.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI&labelColor=7fc5e1&color=fed11e)](https://github.com/tiny-build/aws-cdk-local-lambda/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/aws-cdk-local-lambda?style=for-the-badge&logo=npm&logoColor=white&label=npm&labelColor=7fc5e1&color=f99933)](https://www.npmjs.com/package/aws-cdk-local-lambda)
[![npm downloads](https://img.shields.io/npm/dm/aws-cdk-local-lambda?style=for-the-badge&logo=npm&logoColor=white&label=downloads&labelColor=7fc5e1&color=fed11e)](https://www.npmjs.com/package/aws-cdk-local-lambda)
[![GitHub stars](https://img.shields.io/github/stars/tiny-build/aws-cdk-local-lambda?style=for-the-badge&logo=github&logoColor=white&labelColor=7fc5e1&color=f99933)](https://github.com/tiny-build/aws-cdk-local-lambda/stargazers)

### Built with

![TypeScript](https://img.shields.io/badge/TypeScript-7fc5e1?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_22+-7fc5e1?style=for-the-badge&logo=nodedotjs&logoColor=white)
![AWS CDK](https://img.shields.io/badge/AWS_CDK-f99933?style=for-the-badge&logo=amazonaws&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-f99933?style=for-the-badge&logo=awslambda&logoColor=white)
![Express](https://img.shields.io/badge/Express-7fc5e1?style=for-the-badge&logo=express&logoColor=white)
![esbuild](https://img.shields.io/badge/esbuild-fed11e?style=for-the-badge&logo=esbuild&logoColor=black)
![Pino](https://img.shields.io/badge/Pino-7fc5e1?style=for-the-badge&logo=pino&logoColor=white)
![Ink](https://img.shields.io/badge/Ink-7fc5e1?style=for-the-badge&logo=react&logoColor=white)
![Commander](https://img.shields.io/badge/Commander-fed11e?style=for-the-badge&logoColor=black)
![chokidar](https://img.shields.io/badge/chokidar-7fc5e1?style=for-the-badge&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-fed11e?style=for-the-badge&logo=vitest&logoColor=black)

</div>

---

## Install

```bash
npm install aws-cdk-local-lambda
```
or
```bash
pnpm add aws-cdk-local-lambda
```

> Requires **Node.js ≥ 22.14**.

## Quickstart

The recommended setup is a few scripts in your `package.json`. See the [simple-crud example](https://github.com/tiny-build/aws-cdk-local-lambda/tree/main/examples/simple-crud) for a complete working reference.

```json
{
  "scripts": {
    "synth": "cdk synth --app 'tsx cdk/app.ts'",
    "extract": "cdk-local extract --cdk-out cdk.out --stack MyStack --stage dev --out .cdk-local/manifest.json",
    "manifest": "npm run synth && npm run extract",
    "serve": "cdk-local serve --manifest .cdk-local/manifest.json --port 3001 --watch",
    "dev": "npm run manifest && npm run serve"
  }
}
```

Then:

```bash
npm run dev
```

> Add `.cdk-local/` or whatever path you choose to your `.gitignore` - it holds the generated manifest and would be machine-specific.

`cdk synth` shells out to the AWS CDK CLI. Make sure `cdk` is available on your `PATH` (see the [AWS CDK Getting Started guide](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html)).

## CLI reference

```
cdk-local dev     --cdk-out <dir> --stack <name> [--stage <env>] [--port 3001] [--no-watch] [--repo-root <dir>] [--quiet]
cdk-local extract --cdk-out <dir> --stack <name> [--stage <env>] [--out <file>] [--synth] [--repo-root <dir>] [--quiet]
cdk-local serve   --manifest <file> [--port 3001] [--watch] [--quiet]
```

| Command   | Purpose                                                   | Watch default      |
|-----------|-----------------------------------------------------------|--------------------|
| `dev`     | `extract` + `serve` in one step.                          | on (`--no-watch`)  |
| `extract` | Writes a `LocalManifest` JSON to `--out` (or stdout).     | n/a                |
| `serve`   | Reads a pre-extracted manifest and starts the server.     | opt-in (`--watch`) |

Pass `--synth` to `extract` to run `cdk synth` first (useful after cloning, since esbuild embeds absolute source paths in bundles).

### `extract` options

| Flag | Required | Description |
|------|----------|-------------|
| `--cdk-out <dir>` | yes | Path to the `cdk.out` directory |
| `--stack <name>` | yes | CloudFormation stack name |
| `--stage <env>` | no | Stage suffix used to strip prefixes from Lambda function names (e.g. `dev`). Omit if your function names have no stage prefix. |
| `--out <file>` | no | Output path for the manifest JSON (default: stdout) |
| `--synth` | no | Run `cdk synth` before extracting |
| `--repo-root <dir>` | no | Repo root for resolving handler source paths (default: cwd) |
| `--quiet` | no | Suppress framework log output (file changes, module invalidations, etc.) |

### `serve` options

| Flag | Required | Description |
|------|----------|-------------|
| `--manifest <file>` | yes | Path to a manifest JSON produced by `extract` |
| `--port <n>` | no | Port to listen on (default: `3001`) |
| `--watch` | no | Enable hot reload on handler file changes |
| `--quiet` | no | Suppress framework log output |

### `dev` options

Accepts all `extract` options plus `--port`, `--no-watch`, and `--quiet`.

## Hot reload

On any file change under the watched paths (default: derived from each Lambda's manifest `entry`, walked up to the nearest `src/` ancestor), the loader invalidates its handler cache.

No process restart. Recovery from bundle markers happens at `extract` time only.

## Programmatic usage

```ts
import { extractManifest } from "aws-cdk-local-lambda/extract";
import { createLocalApp } from "aws-cdk-local-lambda/server";

const manifest = await extractManifest({
  cdkOut: "cdk.out",   // path to cdk.out directory
  stack: "MyStack",
  stage: "dev",
  repoRoot: process.cwd(),           // optional: root for resolving handler paths
  onWarning: (msg) => console.warn(msg),
});

const { app, routes, stop } = await createLocalApp({
  manifest,
  watch: true,
  corsOptions: { origin: "*" },      // optional: passed directly to the cors middleware
  bodyLimit: "10mb",                 // optional: express body-parser limit (default: "1mb")
  healthPath: "/_health",            // optional: adds a 200 OK health endpoint
  onReload: (path, n) => console.log(`reloaded ${n} handlers after ${path}`),
  onError: (err, req) => console.error(req.path, err),
});

app.listen(3001);
// routes is a readonly string[] of all registered paths, e.g. ["GET /items", "POST /items"]
// call stop() to drain the watcher and release resources
```

`createLocalApp` does not call `app.listen` - the caller owns the port and server lifecycle.

### Controlling framework log output

By default the framework logs file change detections, module invalidations, and other internal events to stderr. Pass `onFrameworkLog` to redirect or silence them. The "listening on port" line and your Lambda handler logs are always printed regardless.

```ts
// silence all framework logs
createLocalApp({ manifest, onFrameworkLog: () => {} });

// pipe to your own logger
createLocalApp({ manifest, onFrameworkLog: (msg) => myLogger.debug(msg) });
```

The same option is available on `extractManifest` to suppress entry-recovery logs during the extract phase.

## Resources
- [Example stack](https://github.com/tiny-build/aws-cdk-local-lambda/tree/main/examples/simple-crud)

## What this package does NOT do

- Load `.env` files or set `AWS_REGION` defaults - that's the consumer's job.
- Call `app.listen` from `createLocalApp` - the consumer owns the port and lifecycle.
- Know about any repo-specific naming conventions (function prefixes, authorizer keys, etc.).


## License

[MIT](https://github.com/tiny-build/aws-cdk-local-lambda/blob/main/LICENSE) © tiny-build

---

> This project is not affiliated with, endorsed by, or sponsored by Amazon Web Services (AWS) in any way. AWS, CDK, Lambda, and API Gateway are trademarks of Amazon.com, Inc. or its affiliates. All trademarks and copyrights referenced in this project belong to their respective owners.
