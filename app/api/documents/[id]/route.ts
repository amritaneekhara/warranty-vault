import { NextResponse } from 'next/server';

import { getDocumentForDownload, getUserId } from '@/app/api/_warranty-storage';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function getId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function GET(request: Request, context: RouteContext) {
  const result = await getDocumentForDownload(
    getUserId(request),
    await getId(context),
  );
  if (!result)
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const headers = new Headers();
  result.object.writeHttpMetadata(headers);
  headers.set('content-type', result.document.type);
  headers.set('content-length', String(result.document.size));
  headers.set('cache-control', 'private, max-age=300');

  const disposition = new URL(request.url).searchParams.has('download')
    ? 'attachment'
    : 'inline';
  headers.set(
    'content-disposition',
    `${disposition}; filename="${encodeURIComponent(result.document.name)}"`,
  );

  return new Response(result.object.body, { headers });
}
