# Development Guide

Internal reference for maintainers of this monorepo.

## Prerequisites

- Node >= 22 (CI uses `.node-version`)
- pnpm >= 10

## Local setup

```bash
git clone <repo-url>
cd cdk-lambda-local
pnpm install
```

## Daily development

```bash
# Lint changed projects
pnpx nx affected --target=lint --base=main

# Typecheck changed projects
pnpx nx affected --target=typecheck --base=main

# Build changed projects
pnpx nx affected --target=build --base=main

# Run tests for changed projects
pnpx nx affected --target=test --base=main

# Format repository
pnpm format
```

## Working on cdk-local-lambda

```bash
# Build package
pnpx nx build cdk-local-lambda

# Run tests
pnpx nx test cdk-local-lambda

# Typecheck package
pnpx nx typecheck cdk-local-lambda
```

## Changesets

Every PR that changes user-facing behavior must include a changeset.

```bash
pnpm changeset
```

When prompted:

1. Select `@tiny-build/cdk-local-lambda`.
2. Choose bump type (`patch`, `minor`, `major`).
3. Add a short changelog-friendly description.

Commit the generated `.changeset/*.md` file with your PR.

## Release flow

Releases are automated with `.github/workflows/release.yml`.

1. Merge PRs with changesets into `main`.
2. Changesets action opens or updates a `chore: version packages` PR.
3. Merge the version PR.
4. Workflow publishes to npm.

### npm publish auth

The workflow uses npm trusted publishing with GitHub OIDC (`id-token: write`).
No npm token secret is required for automated releases once trusted publishing is configured in npm.

## Manual release (fallback)

```bash
git checkout main
git pull
pnpm install
pnpm build
NPM_TOKEN=<token> pnpm changeset publish
```

Manual release requires npm auth (`NPM_TOKEN` or `npm login`) in your shell.

## Commit convention

Conventional Commits are enforced with commitlint.

Examples:

- `feat(cdk-local-lambda): add manifest validation`
- `fix(server): preserve authorizer headers`
- `docs: update release steps`
