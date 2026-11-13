import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSubscriptionAccess } from '@/lib/billing/access';

/** Require login. Onboarding/subscription gating applies to all of these. */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/properties',
  '/units',
  '/tenants',
  '/leases',
  '/payments',
  '/maintenance',
  '/billing',
  '/onboarding',
];

/** Logged-in users are bounced to /dashboard from these. */
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

/** Auth pages a logged-in user may still need (recovery session, verification). */
const AUTH_ROUTES_ALLOW_SESSION = ['/reset-password', '/verify-email'];

function matches(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session cookie if needed. Must run before any early return
  // that hands back supabaseResponse.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // API routes (incl. M-Pesa / Paystack callbacks) are never redirected.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  /** Redirect while keeping any refreshed Supabase auth cookies. */
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    const [p, query] = path.split('?');
    url.pathname = p;
    url.search = query ? `?${query}` : '';
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  if (matches(pathname, AUTH_ROUTES_ALLOW_SESSION)) {
    if (pathname.startsWith('/reset-password') && !user) {
      return redirectTo(
        `/login?error=${encodeURIComponent('Your password reset link is invalid or has expired. Please request a new one.')}`
      );
    }
    return supabaseResponse;
  }

  if (matches(pathname, AUTH_ROUTES)) {
    return user ? redirectTo('/dashboard') : supabaseResponse;
  }

  if (!matches(pathname, PROTECTED_ROUTES)) {
    // Public: "/", "/pricing", "/auth/*", etc.
    return supabaseResponse;
  }

  if (!user) {
    return redirectTo('/login');
  }

  // ---- Onboarding & subscription gating ----
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    // Fail open on DB errors rather than locking everyone out.
    console.error('[proxy] profile lookup failed:', profileError.message);
    return supabaseResponse;
  }

  const role = profile?.role ?? user.user_metadata?.role;
  if (role === 'tenant') {
    return supabaseResponse;
  }

  const isOnboardingPath = matches(pathname, ['/onboarding']);

  if (!profile?.onboarding_completed) {
    return isOnboardingPath ? supabaseResponse : redirectTo('/onboarding');
  }

  if (isOnboardingPath) {
    return redirectTo('/dashboard');
  }

  if (matches(pathname, ['/billing'])) {
    return supabaseResponse;
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('status, plan_id, trial_ends_at, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  if (subError) {
    console.error('[proxy] subscription lookup failed:', subError.message);
    return supabaseResponse;
  }

  if (!getSubscriptionAccess(subscription).hasAccess) {
    return redirectTo('/billing?expired=1');
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
