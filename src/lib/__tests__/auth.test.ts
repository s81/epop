import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

import { getSession } from '@/lib/session';
import { requireRole, UnauthorizedError } from '@/lib/auth';
import type { SessionPayload } from '@/lib/session';

function mockSession(payload: SessionPayload | null) {
  vi.mocked(getSession).mockResolvedValue(payload);
}

describe('requireRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes when role meets minimum (ADMIN satisfies DATA_ENTRY)', async () => {
    mockSession({ userId: 1, role: 'ADMIN', displayName: 'Alice' });
    const result = await requireRole('DATA_ENTRY');
    expect(result.role).toBe('ADMIN');
  });

  it('passes when role exactly matches minimum', async () => {
    mockSession({ userId: 2, role: 'DATA_ENTRY', displayName: 'Bob' });
    await expect(requireRole('DATA_ENTRY')).resolves.toBeDefined();
  });

  it('throws UnauthorizedError when role is too low', async () => {
    mockSession({ userId: 3, role: 'VIEWER', displayName: 'Carol' });
    await expect(requireRole('DATA_ENTRY')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError when session is null', async () => {
    mockSession(null);
    await expect(requireRole('VIEWER')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ADMIN satisfies ADMIN requirement', async () => {
    mockSession({ userId: 1, role: 'ADMIN', displayName: 'Alice' });
    await expect(requireRole('ADMIN')).resolves.toBeDefined();
  });

  it('DATA_ENTRY does not satisfy ADMIN requirement', async () => {
    mockSession({ userId: 2, role: 'DATA_ENTRY', displayName: 'Bob' });
    await expect(requireRole('ADMIN')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
