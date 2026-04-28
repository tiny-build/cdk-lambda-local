<div align="center">

<img src="readme-assets/cdk-local.png" alt="aws-cdk-local-lambda" width="180" />

# aws-cdk-local-lambda

**Run your CDK API Gateway + Lambda stack locally over HTTP - no mocks, no handler registry.**
Reads `cdk synth` output directly and boots a local Express server that mirrors your deployed routes, with hot reload.

[![CI](https://img.shields.io/github/actions/workflow/status/tiny-build/aws-cdk-local-lambda/release.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI&labelColor=7fc5e1&color=fed11e)](https://github.com/tiny-build/aws-cdk-local-lambda/actions/workflows/release.yml)
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
![Nx](https://img.shields.io/badge/Nx-f99933?style=for-the-badge&logo=nx&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-fed11e?style=for-the-badge&logo=pnpm&logoColor=black)
![Biome](https://img.shields.io/badge/Biome-7fc5e1?style=for-the-badge&logo=biome&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-fed11e?style=for-the-badge&logo=vitest&logoColor=black)

</div>

---

## Why this exists

Iterating on a CDK-deployed API usually means waiting for `cdk deploy`, or wiring up SAM/LocalStack with a handler registry that drifts from your real stack. `aws-cdk-local-lambda` skips all of that:

- **Reads `cdk synth` directly** - your stack template is the source of truth.
- **Real Express server** - no mocks, no registry, no fake invoke.
- **Hot reload** - handlers re-bundle on save, no process restart.
- **Authorizers per route** - invoked exactly like API Gateway does.

## Install

```bash
npm install aws-cdk-local-lambda
```
or
```bash
pnpm add aws-cdk-local-lambda
```

## Quickstart

The recommended setup is a few scripts in your `package.json`. See the [simple-crud example](examples/simple-crud/package.json) for a complete working setup.

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

Then run:

```bash
npm run dev
```

> [!NOTE]
> Add `.cdk-local/` or whatever path you choose to your `.gitignore` - it holds the generated manifest and would be machine-specific.

## CLI reference

### All-in-one: extract + serve
```bash
npx cdk-local dev --cdk-out cdk.out --stack MyStack --stage dev --port 3001
```

### Step 1 - parse cdk.out into a manifest file
```bash
npx cdk-local extract --cdk-out cdk.out --stack MyStack --stage dev --out .cdk-local/manifest.json
```

### Step 2 - start the local server from that manifest
```bash
npx cdk-local serve --manifest .cdk-local/manifest.json --port 3001 --watch
```

**When to keep them separate:** if your handlers don't change between runs, reuse the same manifest and skip re-running `cdk synth`. Only re-extract when you add or rename a handler - the server hot-reloads handler code on save.

| Command   | Purpose                                                              | Watch default                |
|-----------|----------------------------------------------------------------------|------------------------------|
| `dev`     | `extract` + `serve` in one step                                      | on (`--no-watch` to disable) |
| `extract` | Parse `cdk.out` → `LocalManifest` JSON (pass `--synth` to run synth) | n/a                          |
| `serve`   | Boot Express from a pre-built manifest                               | opt-in (`--watch`)           |

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

## Contributing

Contributions are welcome - small PRs, clear commits, conventional commits enforced.

- [CONTRIBUTING.md](CONTRIBUTING.md) - pull request workflow and expectations
- [ARCHITECTURE.md](ARCHITECTURE.md) - high level overview of what the package does internally

## License

[MIT](LICENSE) © tiny-build

---

> This project is not affiliated with, endorsed by, or sponsored by Amazon Web Services (AWS) in any way. AWS, CDK, Lambda, and API Gateway are trademarks of Amazon.com, Inc. or its affiliates. All trademarks and copyrights referenced in this project belong to their respective owners.
