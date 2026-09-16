# Handoff

## State
`main` in sync with origin at `1a4f97f`. Tree clean. Inventory review fixes, dependency hygiene, TypeScript 7.0.2 (native tsc), Next 16 proxy migration all landed.
Migration 0007 = two `CREATE TRIGGER IF NOT EXISTS` sign-check triggers. `src/lib/db-errors.ts` `dbErrorMessage()` used by all admin actions. `deleteMaterial`/`deleteCategory` return `{ error }`; `CrudPage` renders it.
`npm audit` = 0 vulns (next 16.3.5, esbuild override `~0.28.0`). Auth gate is `src/proxy.ts` (was middleware.ts). No open PRs. Real test count is 113/113 (16 files); `next build` passes.

## Next
1. Next build phase per `docs/superpowers/plans/` — BOM / material consumption from work orders is the likely follow-on to inventory.
2. When moving to drizzle-kit 1.0: delete `overrides.esbuild` in package.json.

## Context
- `next build` was silently broken since Next 16 (webpack block in next.config.ts); fixed in 427b8c0. Docker image builds again.
- `scripts/migrate.ts` replays every migration on every boot, no tracking table → every migration MUST be idempotent (`IF NOT EXISTS`, triggers over table rebuilds).
- Earlier "216 tests" was doubled by a stale worktree under `.claude/worktrees/`; removed, and `vitest.config.ts` now excludes `.claude/**`.
- Remote is HTTPS with `gh auth setup-git`; global git identity `S81 <samer.w.alhaddadin@gmail.com>`. No SSH key here.
- Older admin action files are CRLF on disk; new ones LF. `perl -0pi` edits need `\r?\n`.
- tsconfig.json / next-env.d.ts are rewritten by `next build`; commit what it writes, don't hand-edit.
