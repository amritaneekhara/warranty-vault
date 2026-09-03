import { NextResponse } from 'next/server';

import { getUserId } from '@/app/api/_warranty-storage';

export function GET(request: Request) {
  return NextResponse.json({ authenticated: Boolean(getUserId(request)) });
}
