import { asc } from 'drizzle-orm';
import { db } from '@/db/db';
import { user } from '@/db/schema';
import { getSession } from '@/lib/session';
import { notFound } from 'next/navigation';
import { UsersClient } from './client';
import { deleteUser } from './actions';

export default async function UsersPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') notFound();

  const users = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    })
    .from(user)
    .orderBy(asc(user.username));

  return (
    <UsersClient
      data={users}
      currentUserId={session.userId}
      onDelete={deleteUser}
    />
  );
}
