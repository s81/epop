import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/session';

const COOKIE = 'epop_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE)?.value ?? null;

  if (pathname.startsWith('/login') || pathname.startsWith('/tablet')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/orders')) {
    const session = token ? await getSessionFromToken(token) : null;

    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/admin/users') && session.role !== 'ADMIN') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
