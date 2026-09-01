import { NextResponse } from 'next/server';

import {
  createWarrantyItem,
  getUserId,
  listWarrantyItems,
  type IncomingWarrantyItem,
} from '@/app/api/_warranty-storage';

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Storage request timed out')), milliseconds);
    }),
  ]);
}

export async function GET(request: Request) {
  try {
    const items = await withTimeout(listWarrantyItems(getUserId(request)), 5000);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({
      items: [],
      warning: 'Warranty storage is still warming up. Please refresh shortly.',
    });
  }
}

export async function POST(request: Request) {
  const input = (await request
    .json()
    .catch(() => ({}))) as IncomingWarrantyItem;
  const item = await createWarrantyItem(getUserId(request), input);
  return NextResponse.json({ item }, { status: 201 });
}
