# Handoff

## State
Inventory review fixes + dependency hygiene all on `main`, in sync with origin (latest `0fbb49c`).
Migration 0007 = two `CREATE TRIGGER IF NOT EXISTS` sign-check triggers. `src/lib/db-errors.ts` `dbErrorMessage()` used by all admin actions. `deleteMaterial`/`deleteCategory` return `{ error }`; `CrudPage` renders it.
`npm audit` = 0 vulnerabilities (next 16.3.5, sharp 0.35.4, esbuild override `~0.28.0` in package.json). All dependabot PRs closed; no open PRs. 216/216 tests, tsc clean.

## Next
1. Next build phase per `docs/superpowers/plans/` — BOM / material consumption from work orders is the likely follow-on to inventory.
2. When moving to drizzle-kit 1.0: delete the `overrides.esbuild` entry in package.json (1.0 pulls a current esbuild itself).

## Context
- Remote is HTTPS with `gh auth setup-git` as credential helper; global git identity `S81 <samer.w.alhaddadin@gmail.com>`. No SSH key on this machine.
- `scripts/migrate.ts` replays every migration on every boot with no tracking table → every migration MUST be idempotent (`IF NOT EXISTS`, triggers over table rebuilds).
- Older admin action files (users, etc.) are CRLF on disk; new ones LF. `perl -0pi` edits need `\r?\n`.
- Tests bootstrap by `readdirSync` over `src/db/migrations/*.sql`, not a hard-coded list.
- `.remember/remember.md` is force-tracked despite the plugin's `.gitignore`; commit it with plain `git add` (already tracked).
