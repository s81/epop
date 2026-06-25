import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from '@/db/schema';

const COOKIE_NAME = 'epop_session';
const ALG = 'HS256';
const SESSION_MS = 8 * 60 * 60 * 1000;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is not set');
  return new TextEncoder().encode(s);
}

export type SessionPayload = { userId: number; role: UserRole; displayName: string };

export async function getSessionFromToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: Number(payload.sub),
      role: payload.role as UserRole,
      displayName: payload.displayName as string,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionFromToken(token);
}

export async function createSessionCookie(
  userId: number,
  role: UserRole,
  displayName: string,
): Promise<void> {
  const exp = Math.floor((Date.now() + SESSION_MS) / 1000);
  const token = await new SignJWT({ sub: String(userId), role, displayName })
    .setProtectedHeader({ alg: ALG })
    .setExpirationTime(exp)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + SESSION_MS),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
