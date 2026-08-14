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
- Build engine: **Next.js + `--webpack` flag** (upstream uses this; removing it makes Next 16 default to Turbopack, which produces broken CSS chunks w/ Tailwind v4). Keep `--webpack` in every `next build`/`next dev` script.
- Build inputs: upstream does **not commit `package-lock.json`** and uses `npm install` (no lockfile) in Docker. Our fork mirrors this — do not introduce `npm ci` w/ lockfile unless prepared to keep the lockfile in perfect sync w/ upstream's `package.json` post every merge.
- Cache: removed. Builds run with `no-cache: true` so stale layers can't poison output.
- Runtime user inside container: `node` (uid 1000), entrypoint drops privileges via `gosu`

## Fork divergence (local patches ahead of upstream)

> Based on `HEAD` merged with upstream `v0.5.55`. Live check: `git log github/master..HEAD --oneline` — update this section after each upstream merge.

**What users actually notice:**

- **Cleaner sidebar** — removed 9Remote and 9English promo buttons, links (`9remote.cc` / `9english.net`), and popup modal. Self-hosted fork doesn't need cross-promo; sidebar now only shows real navigation + Settings.
- **Faster page load** — icon font trimmed 96% (3.8 MB → 133 KB) and preloaded with `font-display:swap`. Pages render immediately instead of blocking on the full icon bundle. Also fixes 12 tool-card icons (`restore` → `restart_alt`).
- **New provider: Meta Muse Spark** — `api.meta.ai` now selectable in the provider list with its own icon (`open-sse/providers/registry/meta.js`).
- **No user impact** — one test fix for upstream rename `enableObservability` (stability only).

**For merge agents:** preserve these fork files on `git pull github master`: `Sidebar.js`, `src/app/{globals.css,layout.js}`, `Dockerfile` (font build deps + `public/fonts` copy), `package.json` (`build` subset step), `public/i18n/*`, `*ToolCard.js`, `open-sse/providers/registry/meta.js`. Prefer `origin` for promo/font/build hunks, `github` for app logic. Bump tag suffix `-a` → `-b` → `-c` … if only infra changed.

## Current CI behavior (this repo)

Workflow: `.forgejo/workflows/docker-build.yml`

- **Trigger**: tag push only (`on: push: tags: ["*"]`). `master` push does **not** build.
- **Image tag**: derived directly from git tag name (no prefix stripping expected). CI uses `GITHUB_REF_NAME` verbatim.
- **Tag format**: **bare, no `v` prefix** (e.g. `0.5.4`, not `v0.5.4`) — tag must equal `package.json` `version` exactly so the image tag matches the version string. Ignore legacy `v`-prefixed tags in history; do not follow that pattern. Do **not** rewrite the CI to strip `v` — fix the tag instead.
- **Tags pushed per build**: `forgejo.xynogen.xyz/xynogen/9router:<version>` and `:latest`.
- **No `package.json` read in CI** — the git tag name is the single source of truth for the image version. Agents must align `package.json` version and tag name before pushing.
- **Registry**: `forgejo.xynogen.xyz/xynogen/9router` (auth via `secrets.REGISTRY_TOKEN`).

Practical release sequence (this repo):

1. Bump `version` in `package.json` (commit if changed).
2. `git tag <version>` matching the new `package.json` version.
3. `git push origin <version>` → triggers CI → publishes `:<version>` + `:latest`.

## Tag-based release CI (when applicable)

Some repos in this owner's ecosystem use **tag-triggered release workflows**. Pattern to recognize and respect:

### Trigger model

- Workflow runs on **tag push only** (`on: push: tags: ["*"]`). Branch pushes — including `master`/`main` — do **not** trigger release builds.
- Pushing a tag = publishing a release. There are no "throwaway" tags; every pushed tag creates/updates a Forgejo Release with artifacts attached.

### Version derivation (priority order)

1. `workflow_dispatch.inputs.version` if manually dispatched with override
2. Tag name as-is (e.g. `3.7`, `3.7-rc1`)
3. Fallback for non-tag manual dispatch: project metadata + `+git<shortsha>` suffix

### Tag naming conventions

- Releases: `X.Y` or `X.Y.Z` → cleanest version strings, **must match `package.json` `version`**
- Pre-releases: `X.Y-rcN`, `X.Y-beta1`
- **CI/build iteration suffixes**: `X.Y.Z-a`, `X.Y.Z-b`, `X.Y.Z-c`, … → used when fixing CI/CD or build infra **without** changing app code. These tags intentionally **do not match** `package.json` and **must not** trigger a `package.json` version bump. Increment the letter (`-a` → `-b` → `-c` → `-d` …) for each re-run on the same app version.
- Anything else (e.g. `3.7-test`) still triggers a full build + release publish

### Agent-driven release flow

When the user asks to "run the CI", "publish a release", "tag a release", or similar:

1. Read the app version from project metadata (e.g. `version` field in `package.json`, or equivalent for non-JS projects).
2. Check whether a git tag matching that version already exists locally and on `origin`:

   ```
   git tag -l "<version>"
   git ls-remote --tags origin "<version>"
   ```

3. If the tag already exists → **stop and ask the user** before doing anything. Options to surface: bump the version in metadata, delete the existing tag (destructive — needs confirmation), or pick a different tag name.
4. If the tag does not exist → confirm the version + tag name with the user, then:

   ```
   git tag <version>
   git push origin <version>
   ```

5. Pushing the tag triggers the workflow. CI consumes the tag name directly and uses it as the Docker image tag — no version is read from `package.json` at build time. Do not attempt to manually invoke jobs unless the user explicitly asks.

Never tag/push without user confirmation — tag pushes are irreversible-by-default (they publish a release).

### Cleaning up bad tags

```
git push origin :refs/tags/<tag>   # delete remote
git tag -d <tag>                    # delete local
```

The Forgejo Release created by the tag must be deleted separately via UI/API.

### What agents should NOT assume

- Pushing to `master`/`main` triggers a release — it doesn't; only tags do
- State carries between workflow runs — it doesn't; jobs run in fresh containers
