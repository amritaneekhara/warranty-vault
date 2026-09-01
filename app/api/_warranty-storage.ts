import { env } from 'cloudflare:workers';

import { warrantySchemaSql } from '@/db/schema';

type PurchaseMode = 'online' | 'offline';

export type StoredDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  url: string;
  downloadUrl: string;
};

export type StoredWarrantyItem = {
  id: string;
  productName: string;
  brand: string;
  category: string;
  purchaseDate: string;
  warrantyEndDate: string;
  invoiceAmount: number;
  purchaseMode: PurchaseMode;
  storeName: string;
  storeAddress: string;
  pointOfContact: string;
  notes: string;
  documents: StoredDocument[];
};

export type IncomingDocument = {
  id?: string;
  name?: string;
  type?: string;
  size?: number;
  dataUrl?: string;
};

export type IncomingWarrantyItem = {
  productName?: string;
  brand?: string;
  category?: string;
  purchaseDate?: string;
  warrantyEndDate?: string;
  invoiceAmount?: number;
  purchaseMode?: PurchaseMode;
  storeName?: string;
  storeAddress?: string;
  pointOfContact?: string;
  notes?: string;
  documents?: IncomingDocument[];
};

type Bindings = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
};

type ItemRow = {
  id: string;
  product_name: string;
  brand: string;
  category: string;
  purchase_date: string;
  warranty_end_date: string;
  invoice_amount: number;
  purchase_mode: PurchaseMode;
  store_name: string;
  store_address: string;
  point_of_contact: string;
  notes: string;
};

type DocumentRow = {
  id: string;
  item_id: string;
  object_key: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
};

type DocumentMatch = DocumentRow & {
  product_name: string;
};

let schemaReady: Promise<void> | null = null;

function getBindings() {
  return env as unknown as Bindings;
}

export function getUserId(request: Request) {
  return request.headers.get('oai-authenticated-user-id') ?? 'local-dev-user';
}

export async function ensureSchema() {
  if (!schemaReady) {
    const { DB } = getBindings();
    schemaReady = DB.batch(
      warrantySchemaSql.map((sql) => DB.prepare(sql)),
    ).then(() => undefined);
  }

  await schemaReady;
}

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanDate(value: unknown, fallback: string) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function cleanPurchaseMode(value: unknown): PurchaseMode {
  return value === 'offline' ? 'offline' : 'online';
}

function cleanAmount(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function documentUrls(id: string) {
  return {
    url: `/api/documents/${id}`,
    downloadUrl: `/api/documents/${id}?download=1`,
  };
}

function toStoredDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: row.size,
    uploadedAt: row.uploaded_at,
    ...documentUrls(row.id),
  };
}

function toStoredItem(
  row: ItemRow,
  documents: StoredDocument[],
): StoredWarrantyItem {
  return {
    id: row.id,
    productName: row.product_name,
    brand: row.brand,
    category: row.category,
    purchaseDate: row.purchase_date,
    warrantyEndDate: row.warranty_end_date,
    invoiceAmount: row.invoice_amount,
    purchaseMode: row.purchase_mode,
    storeName: row.store_name,
    storeAddress: row.store_address,
    pointOfContact: row.point_of_contact,
    notes: row.notes,
    documents,
  };
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;

  const contentType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? '';

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { contentType, bytes };
  }

  const decoded = decodeURIComponent(payload.replace(/\+/g, ' '));
  return { contentType, bytes: new TextEncoder().encode(decoded) };
}

async function getDocumentsForItems(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return new Map<string, StoredDocument[]>();

  const { DB } = getBindings();
  const placeholders = itemIds.map(() => '?').join(',');
  const { results } = await DB.prepare(
    `SELECT id, item_id, object_key, name, type, size, uploaded_at
     FROM warranty_documents
     WHERE user_id = ? AND item_id IN (${placeholders})
     ORDER BY uploaded_at DESC`,
  )
    .bind(userId, ...itemIds)
    .all<DocumentRow>();

  const byItem = new Map<string, StoredDocument[]>();
  for (const row of results) {
    const current = byItem.get(row.item_id) ?? [];
    current.push(toStoredDocument(row));
    byItem.set(row.item_id, current);
  }

  return byItem;
}

export async function listWarrantyItems(userId: string) {
  await ensureSchema();
  const { DB } = getBindings();
  const { results } = await DB.prepare(
    `SELECT id, product_name, brand, category, purchase_date, warranty_end_date,
      invoice_amount, purchase_mode, store_name, store_address, point_of_contact, notes
     FROM warranty_items
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<ItemRow>();

  const documentsByItem = await getDocumentsForItems(
    userId,
    results.map((row) => row.id),
  );

  return results.map((row) =>
    toStoredItem(row, documentsByItem.get(row.id) ?? []),
  );
}

export async function getWarrantyItem(userId: string, itemId: string) {
  await ensureSchema();
  const { DB } = getBindings();
  const item = await DB.prepare(
    `SELECT id, product_name, brand, category, purchase_date, warranty_end_date,
      invoice_amount, purchase_mode, store_name, store_address, point_of_contact, notes
     FROM warranty_items
     WHERE user_id = ? AND id = ?`,
  )
    .bind(userId, itemId)
    .first<ItemRow>();

  if (!item) return null;
  const documentsByItem = await getDocumentsForItems(userId, [itemId]);
  return toStoredItem(item, documentsByItem.get(itemId) ?? []);
}

async function saveIncomingDocuments(
  userId: string,
  itemId: string,
  documents: IncomingDocument[],
) {
  const { DB, DOCUMENTS } = getBindings();
  const saved: StoredDocument[] = [];

  for (const document of documents) {
    const dataUrl = cleanText(document.dataUrl);
    if (!dataUrl.startsWith('data:')) continue;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) continue;

    const id = crypto.randomUUID();
    const type =
      cleanText(document.type, parsed.contentType) || parsed.contentType;
    const name = cleanText(document.name, 'supporting-document');
    const size =
      typeof document.size === 'number' && Number.isFinite(document.size)
        ? Math.max(0, Math.round(document.size))
        : parsed.bytes.byteLength;
    const uploadedAt = new Date().toISOString();
    const objectKey = `${userId}/${itemId}/${id}-${name.replace(/[^a-z0-9_.-]+/gi, '-')}`;

    await DOCUMENTS.put(objectKey, parsed.bytes, {
      httpMetadata: { contentType: type },
      customMetadata: { name },
    });
    await DB.prepare(
      `INSERT INTO warranty_documents
        (id, item_id, user_id, object_key, name, type, size, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, itemId, userId, objectKey, name, type, size, uploadedAt)
      .run();

    saved.push({
      id,
      name,
      type,
      size,
      uploadedAt,
      ...documentUrls(id),
    });
  }

  return saved;
}

export async function createWarrantyItem(
  userId: string,
  input: IncomingWarrantyItem,
) {
  await ensureSchema();
  const { DB } = getBindings();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await DB.prepare(
    `INSERT INTO warranty_items
      (id, user_id, product_name, brand, category, purchase_date, warranty_end_date,
       invoice_amount, purchase_mode, store_name, store_address, point_of_contact,
       notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      cleanText(input.productName, 'Untitled product') || 'Untitled product',
      cleanText(input.brand),
      cleanText(input.category),
      cleanDate(input.purchaseDate, today()),
      cleanDate(input.warrantyEndDate, today(365)),
      cleanAmount(input.invoiceAmount),
      cleanPurchaseMode(input.purchaseMode),
      cleanText(input.storeName),
      cleanText(input.storeAddress),
      cleanText(input.pointOfContact),
      cleanText(input.notes),
      now,
      now,
    )
    .run();

  await saveIncomingDocuments(userId, id, input.documents ?? []);
  const item = await getWarrantyItem(userId, id);
  if (!item) throw new Error('Warranty item was not created');
  return item;
}

export async function updateWarrantyItem(
  userId: string,
  itemId: string,
  input: IncomingWarrantyItem,
) {
  await ensureSchema();
  const { DB, DOCUMENTS } = getBindings();
  const existing = await getWarrantyItem(userId, itemId);
  if (!existing) return null;

  const incomingDocuments = Array.isArray(input.documents)
    ? input.documents
    : [];
  const retainedIds = new Set(
    incomingDocuments
      .map((document) => cleanText(document.id))
      .filter((id) =>
        existing.documents.some((document) => document.id === id),
      ),
  );
  const removed = existing.documents.filter(
    (document) => !retainedIds.has(document.id),
  );

  if (removed.length > 0) {
    const placeholders = removed.map(() => '?').join(',');
    const { results } = await DB.prepare(
      `SELECT object_key FROM warranty_documents
       WHERE user_id = ? AND id IN (${placeholders})`,
    )
      .bind(userId, ...removed.map((document) => document.id))
      .all<{ object_key: string }>();

    await Promise.all(results.map((row) => DOCUMENTS.delete(row.object_key)));
    await DB.prepare(
      `DELETE FROM warranty_documents
       WHERE user_id = ? AND id IN (${placeholders})`,
    )
      .bind(userId, ...removed.map((document) => document.id))
      .run();
  }

  await DB.prepare(
    `UPDATE warranty_items
     SET product_name = ?, brand = ?, category = ?, purchase_date = ?,
       warranty_end_date = ?, invoice_amount = ?, purchase_mode = ?, store_name = ?,
       store_address = ?, point_of_contact = ?, notes = ?, updated_at = ?
     WHERE user_id = ? AND id = ?`,
  )
    .bind(
      cleanText(input.productName, 'Untitled product') || 'Untitled product',
      cleanText(input.brand),
      cleanText(input.category),
      cleanDate(input.purchaseDate, today()),
      cleanDate(input.warrantyEndDate, today(365)),
      cleanAmount(input.invoiceAmount),
      cleanPurchaseMode(input.purchaseMode),
      cleanText(input.storeName),
      cleanText(input.storeAddress),
      cleanText(input.pointOfContact),
      cleanText(input.notes),
      new Date().toISOString(),
      userId,
      itemId,
    )
    .run();

  await saveIncomingDocuments(
    userId,
    itemId,
    incomingDocuments.filter((document) =>
      cleanText(document.dataUrl).startsWith('data:'),
    ),
  );

  return getWarrantyItem(userId, itemId);
}

export async function addDocumentsToWarranty(
  userId: string,
  itemId: string,
  documents: IncomingDocument[],
) {
  await ensureSchema();
  const existing = await getWarrantyItem(userId, itemId);
  if (!existing) return null;

  await saveIncomingDocuments(userId, itemId, documents);
  return getWarrantyItem(userId, itemId);
}

export async function deleteWarrantyItem(userId: string, itemId: string) {
  await ensureSchema();
  const { DB, DOCUMENTS } = getBindings();
  const existing = await getWarrantyItem(userId, itemId);
  if (!existing) return false;

  const { results } = await DB.prepare(
    `SELECT object_key FROM warranty_documents WHERE user_id = ? AND item_id = ?`,
  )
    .bind(userId, itemId)
    .all<{ object_key: string }>();

  await Promise.all(results.map((row) => DOCUMENTS.delete(row.object_key)));
  await DB.prepare(
    `DELETE FROM warranty_documents WHERE user_id = ? AND item_id = ?`,
  )
    .bind(userId, itemId)
    .run();
  await DB.prepare(`DELETE FROM warranty_items WHERE user_id = ? AND id = ?`)
    .bind(userId, itemId)
    .run();

  return true;
}

export async function getDocumentForDownload(
  userId: string,
  documentId: string,
) {
  await ensureSchema();
  const { DB, DOCUMENTS } = getBindings();
  const document = await DB.prepare(
    `SELECT d.id, d.item_id, d.object_key, d.name, d.type, d.size, d.uploaded_at,
      i.product_name
     FROM warranty_documents d
     INNER JOIN warranty_items i ON i.id = d.item_id AND i.user_id = d.user_id
     WHERE d.user_id = ? AND d.id = ?`,
  )
    .bind(userId, documentId)
    .first<DocumentMatch>();

  if (!document) return null;
  const object = await DOCUMENTS.get(document.object_key);
  if (!object?.body) return null;

  return {
    document,
    object,
  };
}
