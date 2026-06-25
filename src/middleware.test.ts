import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { middleware } from './middleware';

const SECRET = 'test-secret-exactly-thirty-two-bytes!';
beforeAll(() => { process.env.SESSION_SECRET = SECRET; });

const encoded = new TextEncoder().encode(SECRET);

async function makeToken(role: string): Promise<string> {
  return new SignJWT({ sub: '1', role, displayName: 'Test' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(encoded);
}

function req(path: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Cookie', `epop_session=${token}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe('middleware', () => {
  it('passes /login through without a cookie', async () => {
    const res = await middleware(req('/login'));
    expect(res.status).not.toBe(307);
  });

  it('passes /tablet/1 through without a cookie', async () => {
    const res = await middleware(req('/tablet/1'));
    expect(res.status).not.toBe(307);
  });

  it('redirects /admin/departments to /login when no cookie', async () => {
    const res = await middleware(req('/admin/departments'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects /orders to /login when no cookie', async () => {
    const res = await middleware(req('/orders'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('passes /admin/departments with valid DATA_ENTRY token', async () => {
    const token = await makeToken('DATA_ENTRY');
    const res = await middleware(req('/admin/departments', token));
    expect(res.status).not.toBe(307);
  });

  it('redirects /admin/users to /admin when role is DATA_ENTRY', async () => {
    const token = await makeToken('DATA_ENTRY');
    const res = await middleware(req('/admin/users', token));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin');
  });

  it('passes /admin/users with ADMIN token', async () => {
    const token = await makeToken('ADMIN');
    const res = await middleware(req('/admin/users', token));
    expect(res.status).not.toBe(307);
  });
});
