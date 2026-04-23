# @tiny-build/cdk-local-lambda

Run CDK API Gateway + Lambda apps locally over HTTP, driven from `cdk synth` output.

This repository is an Nx monorepo containing the published package:

- `@tiny-build/cdk-local-lambda`

## Install

```bash
npm install @tiny-build/cdk-local-lambda
```

## CLI usage

```bash
npx cdk-local extract --cdk-out cdk.out --stack MyStack --stage dev --out .local/manifest.json
npx cdk-local serve --manifest .local/manifest.json --port 3001 --watch
```

Or run both in one step:

```bash
npx cdk-local dev --cdk-out cdk.out --stack MyStack --stage dev --port 3001
```

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

Detailed package docs live at:

- `packages/cdk-local-lambda/README.md`

## Contributing

See `CONTRIBUTING.md` for contribution workflow and pull request expectations.
See `DEVELOPMENT.md` for setup, validation, changesets, and release flow.

## License

MIT
