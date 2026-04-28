<div align="center">

<img src="https://raw.githubusercontent.com/tiny-build/cdk-lambda-local/main/readme-assets/cdk-local.png" alt="cdk-lambda-local" width="180" />

# cdk-lambda-local

**Run an API Gateway + Lambda app locally over HTTP, driven entirely by `cdk synth` output.**
No handler registry. No mocks. Hot reload on save.

[![CI](https://img.shields.io/github/actions/workflow/status/tiny-build/cdk-lambda-local/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI&labelColor=7fc5e1&color=fed11e)](https://github.com/tiny-build/cdk-lambda-local/actions/workflows/ci.yml)
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
![Commander](https://img.shields.io/badge/Commander-fed11e?style=for-the-badge&logoColor=black)
![chokidar](https://img.shields.io/badge/chokidar-7fc5e1?style=for-the-badge&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-fed11e?style=for-the-badge&logo=vitest&logoColor=black)

</div>

---

## Install

```bash
npm install cdk-lambda-local
```
or
```bash
pnpm add cdk-lambda-local
```

> Requires **Node.js ≥ 22.14**.

## Get started in one command

> [!TIP]
> The fastest way in is `npx cdk-local init` - an interactive wizard that installs the package, runs `cdk synth`, extracts the manifest, and boots the server.

```bash
npx cdk-local init
```

The wizard:

1. Auto-detects your CDK app (`cdk.json` + `aws-cdk-lib`). Prompts you to pick if multiple are found.
2. Runs `cdk ls` and lets you pick a stack.
3. Prompts for **stage**, **log level** (`trace` → `error`), and **log output** (`stdout` or file at `.cdk-local/logs/dev.log`).
4. Detects your package manager (npm / pnpm / yarn / bun) and installs `cdk-lambda-local` as a dev dependency. Skips if already installed.
5. Runs `cdk synth` and extracts to `.cdk-local/manifest.json`.
6. Writes your choices to `.cdk-local/config.json` and appends `.cdk-local/` to `.gitignore`.
7. Starts the dev server on port `3001` with hot reload and the live dashboard.

> [!NOTE]
> `init` reads variables from a `.env` next to your `cdk.json` (if present) when invoking `cdk ls` / `cdk synth`. Subsequent runs can just use `cdk-local dev` - `dev` and `serve` will pick up `stack`, `stage`, and `manifestPath` from `.cdk-local/config.json`.

> [!IMPORTANT]
> `init` shells out to the AWS CDK CLI. Make sure `cdk` is available on your `PATH` (see the [AWS CDK Getting Started guide](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html)) or that the wizard is invoked inside a project where `cdk` resolves.

## CLI reference

```
cdk-local init
cdk-local dev     [--cdk-out <dir>] [--stack <name>] [--stage <env>] [--port 3001] [--no-watch]
cdk-local extract  --cdk-out <dir>   --stack <name>   --stage <env>  [--out <file>] [--synth]
cdk-local serve   [--manifest <file>] [--port 3001] [--watch]
```

| Command   | Purpose                                                              | Watch default      |
|-----------|----------------------------------------------------------------------|--------------------|
| `init`    | Interactive setup wizard: install + synth + extract + serve.         | on                 |
| `dev`     | `extract` + `serve` in one step. Reads defaults from config.         | on (`--no-watch`)  |
| `extract` | Writes a v2 `LocalManifest` JSON to `--out` (or stdout).             | n/a                |
| `serve`   | Reads a pre-extracted manifest and starts the server.                | opt-in (`--watch`) |

Pass `--synth` to `extract` to run `cdk synth` first (useful after cloning to a new path, since esbuild embeds absolute source paths in bundles).

### Config file

After `init`, your project gets a `.cdk-local/config.json` like:

```json
{
  "cdkRoot": "/abs/path/to/cdk-app",
  "stack": "MyStack",
  "stage": "dev",
  "logLevel": "info",
  "logOutput": "stdout",
  "manifestPath": ".cdk-local/manifest.json"
}
```

`dev` and `serve` fall back to these values when CLI flags are omitted.

## Hot reload

On any file change under the watched paths (default: derived from each Lambda's manifest `entry`, walked up to the nearest `src/` ancestor), the loader invalidates its handler cache.

No process restart. Recovery from bundle markers happens at `extract` time only.

## Route specificity

Literal routes win over parameterized routes at the same depth. For example, if both `/users/me` and `/users/{id}` are registered, `GET /users/me` matches the literal handler, while `GET /users/42` falls through to the parameterized one - matching API Gateway's behavior.

## Resources
- [Example stack](https://github.com/tiny-build/cdk-lambda-local/tree/main/examples/simple-crud)

## What this package does NOT do

- Load `.env` files or set `AWS_REGION` defaults - that's the consumer's job.
- Call `app.listen` from `createLocalApp` - the consumer owns the port and lifecycle.
- Know about any repo-specific naming conventions (function prefixes, authorizer keys, etc.).


## License

[MIT](https://github.com/tiny-build/cdk-lambda-local/blob/main/LICENSE) © tiny-build
