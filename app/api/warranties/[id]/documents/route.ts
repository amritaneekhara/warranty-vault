import { NextResponse } from 'next/server';

import {
  addDocumentsToWarranty,
  getUserId,
  type IncomingDocument,
} from '@/app/api/_warranty-storage';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function getId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function POST(request: Request, context: RouteContext) {
  const userId = getUserId(request);
  if (!userId)
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    documents?: IncomingDocument[];
  };
  const item = await addDocumentsToWarranty(
    userId,
    await getId(context),
    Array.isArray(body.documents) ? body.documents : [],
  );

  if (!item)
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json({ item });
}
