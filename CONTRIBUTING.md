# Contributing to Skillful

Thanks for contributing.

Skillful is a desktop app for managing local AI skills and agents as real folders on disk. The codebase is still evolving quickly, but the core expectations are already stable.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/)

### Development Setup

1. Fork and clone the repository.
2. Install dependencies:

```bash
bun install
```

3. Start the app in development mode:

```bash
bun run dev
```

## Project Principles

If you are changing behavior, preserve these constraints:

- the filesystem is the source of truth
- collections are separate from tool install destinations
- skills and agents are folder-based items
- UI and filesystem logic should stay cleanly separated
- new behavior should come with tests when practical

## Pull Request Guidelines

- Keep each pull request focused on one logical change.
- Separate cleanup/refactors from feature work unless the refactor is required to make the feature coherent.
- Explain what changed and why.
- Link related issues when relevant.
- Do not bundle unrelated formatting churn into a feature or fix PR.
- Do not update release versions as part of normal contribution work.

## Before You Start

- Search existing issues and pull requests first.
- If you want to introduce a new dependency, architectural change, or major workflow shift, open an issue or discussion first.
- Prefer small, reviewable changes over broad rewrites.

## Code Standards

- Follow the existing naming and structural conventions.
- Prefer small reusable components and hooks when they improve clarity.
- Keep filesystem helpers in the filesystem layer rather than embedding them in UI code.
- Use Mantine components where they fit instead of rebuilding common UI primitives.
- Do not add backward-compatibility code for unpublished formats unless there is a concrete reason.
- Keep comments sparse and useful.

## Checks

Run the standard checks before opening a PR:

```bash
bun run check
bun run test:e2e
```

If you are working on the Playwright suite, these helpers are also available:

```bash
bun run test:e2e:headed
bun run test:e2e:debug
bun run test:e2e:show-report
```

## AI Usage Policy

AI assistance is allowed, but contributors remain responsible for:

- understanding the code they submit
- validating the behavior they change
- keeping changes aligned with project patterns
- addressing review feedback directly and concretely

## Bug Reports And Feature Requests

Use the GitHub issue templates:

- bug reports for broken behavior
- feature requests for new ideas or workflow changes

Before opening a new issue, search for existing reports first.

## Review Expectations

- All changes require review before merging.
- Review may reject technically working changes if they increase complexity unnecessarily.
- Maintaining a coherent architecture is more important than landing code quickly.

## License

By contributing to this project, you agree that your contributions will be licensed under the project license. See [LICENSE](./LICENSE).
