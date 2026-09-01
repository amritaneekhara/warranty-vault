import { NextResponse } from 'next/server';

import {
  createWarrantyItem,
  getUserId,
  listWarrantyItems,
  type IncomingWarrantyItem,
} from '@/app/api/_warranty-storage';

export async function GET(request: Request) {
  const items = await listWarrantyItems(getUserId(request));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const input = (await request
    .json()
    .catch(() => ({}))) as IncomingWarrantyItem;
  const item = await createWarrantyItem(getUserId(request), input);
  return NextResponse.json({ item }, { status: 201 });
}
