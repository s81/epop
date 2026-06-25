import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { getSessionFromToken } from '@/lib/session';

const SECRET = 'test-secret-exactly-thirty-two-bytes!';

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

const encoded = new TextEncoder().encode(SECRET);

async function makeToken(
  payload: Record<string, unknown>,
  expOffsetSeconds = 3600,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + expOffsetSeconds)
    .sign(encoded);
}

describe('getSessionFromToken', () => {
  it('returns payload for a valid token', async () => {
    const token = await makeToken({ sub: '7', role: 'ADMIN', displayName: 'Alice' });
    const result = await getSessionFromToken(token);
    expect(result).toEqual({ userId: 7, role: 'ADMIN', displayName: 'Alice' });
  });

  it('returns null for an expired token', async () => {
    const token = await makeToken({ sub: '1', role: 'VIEWER', displayName: 'Bob' }, -1);
    expect(await getSessionFromToken(token)).toBeNull();
  });

  it('returns null for a token with wrong signature', async () => {
    const badEncoded = new TextEncoder().encode('completely-different-secret-32b!!');
    const token = await new SignJWT({ sub: '1', role: 'ADMIN', displayName: 'X' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(badEncoded);
    expect(await getSessionFromToken(token)).toBeNull();
  });
});
