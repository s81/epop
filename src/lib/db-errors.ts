/**
 * Message of a thrown DB error. drizzle wraps the libsql error in DrizzleQueryError,
 * whose own message is the SQL text; the SQLite reason ("UNIQUE constraint failed: …")
 * lives in `.cause`. Returns both so callers can `.includes('UNIQUE')` etc.
 */
export function dbErrorMessage(e: unknown): string {
  const own = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : '';
  return cause ? `${own} ${cause}` : own;
}
