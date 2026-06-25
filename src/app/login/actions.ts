'use server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db/db';
import { user } from '@/db/schema';
import { createSessionCookie, clearSessionCookie } from '@/lib/session';

export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | null> {
  const username = ((formData.get('username') as string) ?? '').trim();
  const password = (formData.get('password') as string) ?? '';

  const [found] = await db.select().from(user).where(eq(user.username, username));
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    return { error: 'بيانات غير صحيحة / Invalid credentials' };
  }

  await db
    .update(user)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(user.id, found.id));

  await createSessionCookie(found.id, found.role, found.displayName);

  const raw = ((formData.get('next') as string) || '').replace(/[^a-z0-9/_-]/gi, '');
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
  redirect(next || '/admin/departments');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
