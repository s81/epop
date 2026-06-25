import { getSession } from './session';
import type { SessionPayload } from './session';
import type { UserRole } from '@/db/schema';

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

const RANK: Record<UserRole, number> = { VIEWER: 0, DATA_ENTRY: 1, ADMIN: 2 };

export async function requireRole(min: UserRole): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || RANK[session.role] < RANK[min]) throw new UnauthorizedError();
  return session;
}
