import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { canAccessRoute, HOME_BY_ROLE, Role } from './lib/auth/roles';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes
  if (
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json'
  ) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  // If not logged in, redirect to /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Fetch verified role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || profile.is_active === false) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userRole = (profile.role as Role) || 'waiter';

  // If user hits root '/', route to their role's home
  if (pathname === '/') {
    const homeRoute = HOME_BY_ROLE[userRole] || '/waiter';
    return NextResponse.redirect(new URL(homeRoute, request.url));
  }

  // Route protection
  if (!canAccessRoute(userRole, pathname)) {
    const fallbackRoute = HOME_BY_ROLE[userRole] || '/login';
    return NextResponse.redirect(new URL(fallbackRoute, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
