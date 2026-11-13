import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { isEquityStatementConfigured, syncEquityStatement } from '@/lib/payments/equity';

export const dynamic = 'force-dynamic';

/**
 * Pulls recent credits from the Equity account statement and applies any the
 * IPN missed. Call on a schedule (e.g. every 15 minutes) with
 *   Authorization: Bearer ${CRON_SECRET}
 * Vercel Cron sends this header automatically when CRON_SECRET is set.
 */

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isEquityStatementConfigured()) {
    return NextResponse.json({ error: 'Equity statement access is not configured' }, { status: 503 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 31 ? Math.floor(daysParam) : 3;

  try {
    const summary = await syncEquityStatement(days);
    console.log('[equity sync]', summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[equity sync] failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
