import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** Only allow same-origin relative paths ("/foo"), never "//evil.com" or "/\evil.com". */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/dashboard';
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeNext(searchParams.get('next'));

  const supabase = await createClient();
  let ok = false;

  if (code) {
    // PKCE flow (default for @supabase/ssr)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    // Token-hash flow (custom email templates using {{ .TokenHash }})
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    ok = !error;
  }

  if (ok) {
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  const message =
    type === 'recovery'
      ? 'Your password reset link is invalid or has expired. Please request a new one.'
      : 'Your link is invalid or has expired. Please sign in or request a new link.';
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}
