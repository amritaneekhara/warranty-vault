import { NextResponse } from 'next/server';

import {
  deleteWarrantyItem,
  getUserId,
  updateWarrantyItem,
  type IncomingWarrantyItem,
} from '@/app/api/_warranty-storage';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function getId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function PUT(request: Request, context: RouteContext) {
  const userId = getUserId(request);
  if (!userId)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const input = (await request
    .json()
    .catch(() => ({}))) as IncomingWarrantyItem;
  const item = await updateWarrantyItem(
    userId,
    await getId(context),
    input,
  );
  if (!item)
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request, context: RouteContext) {
  const userId = getUserId(request);
  if (!userId)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const deleted = await deleteWarrantyItem(
    userId,
    await getId(context),
  );
  if (!deleted)
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
