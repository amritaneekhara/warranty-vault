import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod/v4';

import {
  addDocumentsToWarranty,
  createWarrantyItem,
  getDocumentForDownload,
  getUserId,
  getWarrantyItem,
  listWarrantyItems,
  type IncomingDocument,
  type IncomingWarrantyItem,
  type StoredWarrantyItem,
} from '@/app/api/_warranty-storage';

const warrantyInputSchema = {
  productName: z.string().min(1).describe('Product name'),
  brand: z.string().optional().describe('Brand or manufacturer'),
  category: z.string().optional().describe('Product category'),
  purchaseDate: z
    .string()
    .optional()
    .describe('Purchase date in YYYY-MM-DD format'),
  warrantyEndDate: z
    .string()
    .optional()
    .describe('Warranty end date in YYYY-MM-DD format'),
  invoiceAmount: z
    .number()
    .optional()
    .describe('Invoice amount in Indian rupees'),
  purchaseMode: z
    .enum(['online', 'offline'])
    .optional()
    .describe('Where the item was purchased'),
  storeName: z.string().optional().describe('Online platform or store name'),
  storeAddress: z.string().optional().describe('Store address, if applicable'),
  pointOfContact: z.string().optional().describe('Contact person, phone, email, or URL'),
  notes: z.string().optional().describe('Warranty notes or claim details'),
  documents: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().optional(),
        size: z.number().optional(),
        dataUrl: z.string().describe('Document contents as a data URL'),
      }),
    )
    .optional()
    .describe('Supporting documents as data URLs'),
};

const documentInputSchema = {
  itemId: z.string().min(1).describe('Warranty item ID'),
  documents: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().optional(),
      size: z.number().optional(),
      dataUrl: z.string().describe('Document contents as a data URL'),
    }),
  ),
};

function jsonText(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function summarizeItem(item: StoredWarrantyItem) {
  return {
    ...item,
    currency: 'INR',
    documents: item.documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      uploadedAt: document.uploadedAt,
    })),
  };
}

async function streamToDataUrl(stream: ReadableStream, contentType: string) {
  const buffer = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

function createServer(request: Request) {
  const userId = getUserId(request);
  const server = new McpServer({
    name: 'warranty-vault',
    version: '1.0.0',
    websiteUrl: new URL('/', request.url).toString(),
  });

  server.registerTool(
    'list_warranties',
    {
      title: 'List warranty items',
      description:
        'List the current user warranty items with status-ready dates and document metadata.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Optional search text for product, brand, category, store, or contact'),
        status: z
          .enum(['all', 'active', 'expiring', 'expired'])
          .optional()
          .describe('Optional status filter computed by the client or agent'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query = '' }) => {
      const normalizedQuery = query.trim().toLowerCase();
      const items = await listWarrantyItems(userId);
      const filtered = normalizedQuery
        ? items.filter((item) =>
            [
              item.productName,
              item.brand,
              item.category,
              item.storeName,
              item.pointOfContact,
            ]
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery),
          )
        : items;

      return jsonText({
        currency: 'INR',
        count: filtered.length,
        items: filtered.map(summarizeItem),
      });
    },
  );

  server.registerTool(
    'get_warranty',
    {
      title: 'Get warranty item',
      description: 'Get one warranty item by ID, including supporting document metadata.',
      inputSchema: {
        id: z.string().min(1).describe('Warranty item ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const item = await getWarrantyItem(userId, id);
      return jsonText(item ? summarizeItem(item) : { error: 'Item not found' });
    },
  );

  server.registerTool(
    'create_warranty',
    {
      title: 'Create warranty item',
      description:
        'Create a warranty item for the current user, optionally with supporting document data URLs.',
      inputSchema: warrantyInputSchema,
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      const item = await createWarrantyItem(userId, input as IncomingWarrantyItem);
      return jsonText(summarizeItem(item));
    },
  );

  server.registerTool(
    'list_documents',
    {
      title: 'List warranty documents',
      description:
        'List supporting documents for one warranty item, or all current user warranty documents.',
      inputSchema: {
        itemId: z.string().optional().describe('Optional warranty item ID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ itemId }) => {
      const items = itemId
        ? [await getWarrantyItem(userId, itemId)].filter(
            (item): item is StoredWarrantyItem => Boolean(item),
          )
        : await listWarrantyItems(userId);

      return jsonText({
        documents: items.flatMap((item) =>
          item.documents.map((document) => ({
            id: document.id,
            itemId: item.id,
            itemName: item.productName,
            name: document.name,
            type: document.type,
            size: document.size,
            uploadedAt: document.uploadedAt,
          })),
        ),
      });
    },
  );

  server.registerTool(
    'download_document',
    {
      title: 'Download warranty document',
      description:
        'Return a supporting document as a data URL so an agent can view or download it.',
      inputSchema: {
        documentId: z.string().min(1).describe('Document ID returned by list_documents'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ documentId }) => {
      const result = await getDocumentForDownload(userId, documentId);
      if (!result) return jsonText({ error: 'Document not found' });

      return jsonText({
        id: result.document.id,
        itemId: result.document.item_id,
        itemName: result.document.product_name,
        name: result.document.name,
        type: result.document.type,
        size: result.document.size,
        uploadedAt: result.document.uploaded_at,
        dataUrl: await streamToDataUrl(result.object.body, result.document.type),
      });
    },
  );

  server.registerTool(
    'add_documents',
    {
      title: 'Add supporting documents',
      description:
        'Attach supporting document data URLs to an existing warranty item.',
      inputSchema: documentInputSchema,
      annotations: { readOnlyHint: false },
    },
    async ({ itemId, documents }) => {
      const item = await addDocumentsToWarranty(
        userId,
        itemId,
        documents as IncomingDocument[],
      );
      return jsonText(item ? summarizeItem(item) : { error: 'Item not found' });
    },
  );

  return server;
}

async function handleMcp(request: Request) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createServer(request);

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  return handleMcp(request);
}

export async function POST(request: Request) {
  return handleMcp(request);
}

export async function DELETE(request: Request) {
  return handleMcp(request);
}
