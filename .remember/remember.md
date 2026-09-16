# Handoff

## State
Inventory review fixes committed and pushed: `eb40934` (fixes) + `e50d435` (npm audit fix) on `main`, in sync with origin.
Migration 0007 is now two `CREATE TRIGGER IF NOT EXISTS` sign-check triggers (no table rebuild). New `src/lib/db-errors.ts` `dbErrorMessage()` used by all admin actions. `deleteMaterial`/`deleteCategory` return `{ error }`; `CrudPage` renders it.
All 5 dependabot PRs (#8–#12) closed as superseded; no open PRs. 216/216 tests pass, tsc clean.

## Next
1. Phase 3 per CLAUDE.md build order is done; check `docs/superpowers/plans/` for the next planned phase (BOM / material consumption from work orders is the likely follow-on to inventory).
2. Optional: `npm audit fix --force` for 4 moderate esbuild advisories inside drizzle-kit (dev-only, breaking bump). Left alone deliberately.

## Context
- Remote switched to HTTPS and `gh auth setup-git` installed as credential helper; global git identity set to `S81 <samer.w.alhaddadin@gmail.com>`. No SSH key on this machine.
- `scripts/migrate.ts` replays every migration on every boot with no tracking table, so every migration MUST be idempotent (`IF NOT EXISTS`, triggers over table rebuilds).
- Older admin action files (users, etc.) are CRLF on disk; new ones are LF. `perl -0pi` edits need `\r?\n`.
- Tests bootstrap by reading every `.sql` in `src/db/migrations/` via `readdirSync`, not a hard-coded list.
