'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { db } from '@/db/db';
import { user, USER_ROLES } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import type { UserRole } from '@/db/schema';

export async function saveUser(
  _prev: unknown,
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  await requireRole('ADMIN');
  const id = formData.get('id');
  const username = ((formData.get('username') as string) ?? '').trim();
  const displayName = ((formData.get('displayName') as string) ?? '').trim();
  const role = formData.get('role') as UserRole;
  const password = ((formData.get('password') as string) ?? '').trim();

  if (!USER_ROLES.includes(role)) return { error: 'Invalid role' };

  try {
    if (id) {
      // Edit: update displayName, role, and optionally password. Never update username.
      const updates: Partial<typeof user.$inferInsert> = { displayName, role };
      if (password) updates.passwordHash = await bcrypt.hash(password, 12);
      await db.update(user).set(updates).where(eq(user.id, Number(id)));
    } else {
      if (!password) return { error: 'Password is required for new users' };
      const passwordHash = await bcrypt.hash(password, 12);
      await db.insert(user).values({ username, displayName, role, passwordHash });
    }
    revalidatePath('/admin/users');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.includes('UNIQUE') ? `Username "${username}" already exists` : msg };
  }
}

export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireRole('ADMIN');
  const id = Number(formData.get('id'));
  if (id === session.userId) throw new Error('Cannot delete your own account');
  await db.delete(user).where(eq(user.id, id));
  revalidatePath('/admin/users');
}
