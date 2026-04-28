# Contributing

Thank you for contributing to cdk-local-lambda.

This document covers contribution best practices, branching strategies, and pull request expectations.
For full local setup and release operations, see DEVELOPMENT.md.

## Quick Start

1. Use Node 22+ and pnpm 10+.
2. Install dependencies: pnpm install
3. Validate your changes before opening a PR:
   - pnpm lint
   - pnpm typecheck
   - pnpm build
   - pnpm format

## Branching Strategy

The repository uses a trunk-based workflow with short-lived branches.

1. main is always releasable.
2. Create feature branches from main.
3. Keep branches focused and small.
4. Rebase on top of main regularly to reduce conflicts.
5. Merge through pull requests only.

### Branch Naming

Use one of these prefixes:

- feat/<short-description>
- fix/<short-description>
- chore/<short-description>
- docs/<short-description>
- refactor/<short-description>
- test/<short-description>
- ci/<short-description>
- build/<short-description>
- hotfix/<short-description>

Examples:

- feat/add-history-command
- fix/handle-empty-input
- docs/update-release-notes

## Commit Best Practices

This repo enforces Conventional Commits.

Format:

type(optional-scope): subject

Examples:

- feat(cdk-local-lambda): add route validation
- fix(server): keep case-insensitive headers
- docs: update contributing guide

Tips:

1. Write imperative, present-tense subjects.
2. Keep commits atomic and reviewable.
3. Avoid mixing refactors with behavior changes when possible.

## Pull Request Guidelines

Before opening a PR:

1. Sync your branch with main.
2. Run lint, typecheck, build, and format.
3. Add or update tests when behavior changes.
4. Add a changeset for user-facing changes.

PR quality checklist:

- Clear title and concise description of what changed and why.
- Linked issue (if one exists).
- Notes on breaking changes and migration impact (if any).
- Screenshots or terminal output for UX-visible changes (if relevant).

## Code Style and Scope

1. Follow existing project patterns and naming.
2. Keep public APIs stable unless intentionally changed.
3. Avoid unrelated refactors in the same PR.
4. Prefer small PRs over large, mixed-scope changes.

## Review and Merge Expectations

1. Address review comments with follow-up commits.
2. Resolve conversations before merge.
3. Re-run checks after substantial updates.
4. Use squash merge unless maintainers request otherwise.

## Security and Responsible Changes

1. Do not commit secrets, tokens, or credentials.
2. Highlight dependency or supply-chain risks in PR descriptions.
3. Report security issues privately to maintainers.
