# Agent Notes

## Repository nature

This repo is a **personal fork** of an upstream project, recompiled and run by the owner.

- **`github` remote** → upstream: `https://github.com/decolua/9router.git`
- **`origin` remote** → owner's Forgejo: `https://forgejo.xynogen.xyz/xynogen/9router.git`

The owner regularly pulls from `github` (upstream) and merges into `origin` (their fork). The fork carries local patches — primarily CI/CD configuration for self-hosted Forgejo Actions and Docker build/push to a private registry.

## Merge instability

Pulling and merging upstream into the fork is **unreliable**:

- Upstream rewrites files frequently → unrelated diffs collide with local patches
- CI/CD files (`.forgejo/`, `Dockerfile`, `.dockerignore`) and lockfile state are common conflict points
- Lockfile drift (`package-lock.json` ↔ `package.json`) often appears after merges
- Optional native deps (`lightningcss`, `@next/swc-*`, `better-sqlite3`) cause platform-specific install failures post-merge

### When helping with a post-merge issue

1. Always check `git log --oneline -20` first to see whether a merge commit is the source of the breakage.
2. Treat anything under `.forgejo/`, `Dockerfile`, `.dockerignore`, and lockfile changes as **owner's local patches** — preserve them unless explicitly told otherwise. For CI/CD conflicts, prefer `origin`'s Forgejo workflow.
3. If lockfile is suspect, prefer regenerating on the owner's host (Linux glibc) over trusting upstream's version.
4. The build runs in Docker on a self-hosted Forgejo Actions runner (Ubuntu host, DinD). Local environment differs.

## Build environment summary

- Build target: `node:22-slim` (Debian) — switched from Alpine due to musl/native module pain
- Build engine: Next.js SWC (the `--webpack` flag was removed)
- Cache strategy: `actions/cache@v4` keyed on `package-lock.json` + `Dockerfile` hash
- Runtime user inside container: `node` (uid 1000), entrypoint drops privileges via `gosu`
