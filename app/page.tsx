'use client';

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileText,
  Image as ImageIcon,
  Laptop,
  Monitor,
  Moon,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type PurchaseMode = 'online' | 'offline';
type WarrantyStatus = 'active' | 'expiring' | 'expired';
type ThemePreference = 'light' | 'dark' | 'system';

type WarrantyDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  downloadUrl?: string;
  uploadedAt: string;
};

type WarrantyItem = {
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
  documents: WarrantyDocument[];
};

type WarrantyForm = Omit<WarrantyItem, 'id' | 'documents'>;

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => unknown;
};

type WebMcpHost = {
  registerTool?: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
};

declare global {
  interface Document {
    modelContext?: WebMcpHost;
  }

  interface Navigator {
    modelContext?: WebMcpHost;
  }

  interface Window {
    __warrantyVaultWebMCP?: {
      status?: string;
      tools: WebMcpTool[];
      listTools?: () => WebMcpTool[];
      executeTool: (name: string, input?: Record<string, unknown>) => unknown;
    };
    warrantyVaultAgent?: Window['__warrantyVaultWebMCP'];
  }
}

const emptyForm: WarrantyForm = {
  productName: '',
  brand: '',
  category: '',
  purchaseDate: '',
  warrantyEndDate: '',
  invoiceAmount: 0,
  purchaseMode: 'online',
  storeName: '',
  storeAddress: '',
  pointOfContact: '',
  notes: '',
};

const themeOptions: {
  value: ThemePreference;
  label: string;
  icon: React.ReactElement;
}[] = [
  { value: 'light', label: 'Light', icon: <Sun className="size-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="size-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="size-4" /> },
];

function applyThemePreference(preference: ThemePreference) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle(
    'dark',
    preference === 'dark' || (preference === 'system' && prefersDark),
  );
  document.documentElement.style.colorScheme =
    preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

function createBlankForm(): WarrantyForm {
  return {
    ...emptyForm,
    purchaseDate: daysFromNow(0),
    warrantyEndDate: daysFromNow(365),
  };
}

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readPurchaseMode(input: Record<string, unknown>): PurchaseMode {
  return input.purchaseMode === 'offline' ? 'offline' : 'online';
}

function hasInputField(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function serializeItem(item: WarrantyItem) {
  return {
    id: item.id,
    productName: item.productName,
    brand: item.brand,
    category: item.category,
    purchaseDate: item.purchaseDate,
    warrantyEndDate: item.warrantyEndDate,
    invoiceAmount: item.invoiceAmount,
    purchaseMode: item.purchaseMode,
    storeName: item.storeName,
    storeAddress: item.storeAddress,
    pointOfContact: item.pointOfContact,
    notes: item.notes,
    status: getStatus(item.warrantyEndDate),
    remaining: formatRemaining(item.warrantyEndDate),
    documents: item.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
    })),
  };
}

function serializeDocument(item: WarrantyItem, doc: WarrantyDocument) {
  return {
    id: doc.id,
    itemId: item.id,
    itemName: item.productName,
    name: doc.name,
    type: doc.type,
    size: doc.size,
    uploadedAt: doc.uploadedAt,
    url: doc.url,
    downloadUrl: doc.downloadUrl,
  };
}

function findDocument(items: WarrantyItem[], documentId: string) {
  for (const item of items) {
    const document = item.documents.find((doc) => doc.id === documentId);
    if (document) return { item, document };
  }

  return null;
}

function estimateDataUrlSize(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.max(0, Math.floor((base64.length * 3) / 4));
}

function readDocuments(input: Record<string, unknown>) {
  const rawDocuments = input.documents;
  if (!Array.isArray(rawDocuments)) return [];

  return rawDocuments.flatMap((rawDocument) => {
    if (!rawDocument || typeof rawDocument !== 'object') return [];
    const documentInput = rawDocument as Record<string, unknown>;
    const name = readString(documentInput, 'name') || 'supporting-document';
    const type =
      readString(documentInput, 'type') || 'application/octet-stream';
    const dataUrl = readString(documentInput, 'dataUrl');
    const size =
      readNumber(documentInput, 'size') || estimateDataUrlSize(dataUrl);

    if (!dataUrl.startsWith('data:')) return [];

    return [
      {
        id: crypto.randomUUID(),
        name,
        type,
        size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      },
    ];
  });
}

async function loadWarrantyItems() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  const response = await fetch('/api/warranties', {
    cache: 'no-store',
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));
  if (!response.ok) throw new Error('Unable to load warranty items');
  const payload = (await response.json()) as {
    items?: WarrantyItem[];
    warning?: string;
  };
  if (payload.warning) throw new Error(payload.warning);
  return payload.items ?? [];
}

async function saveWarrantyItem(
  form: WarrantyForm,
  documents: WarrantyDocument[],
  editingId: string | null,
) {
  const payload = {
    ...form,
    productName: form.productName.trim(),
    brand: form.brand.trim(),
    category: form.category.trim(),
    storeName: form.storeName.trim(),
    storeAddress: form.storeAddress.trim(),
    pointOfContact: form.pointOfContact.trim(),
    notes: form.notes.trim(),
    invoiceAmount: Number(form.invoiceAmount) || 0,
    documents,
  };
  const response = await fetch(
    editingId
      ? `/api/warranties/${encodeURIComponent(editingId)}`
      : '/api/warranties',
    {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) throw new Error('Unable to save warranty item');
  const result = (await response.json()) as { item: WarrantyItem };
  return result.item;
}

async function deleteWarrantyItem(itemId: string) {
  const response = await fetch(
    `/api/warranties/${encodeURIComponent(itemId)}`,
    {
      method: 'DELETE',
    },
  );
  if (!response.ok) throw new Error('Unable to delete warranty item');
}

async function addDocumentsToWarrantyItem(
  itemId: string,
  documents: WarrantyDocument[],
) {
  const response = await fetch(
    `/api/warranties/${encodeURIComponent(itemId)}/documents`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documents }),
    },
  );

  if (!response.ok) throw new Error('Unable to add supporting documents');
  const result = (await response.json()) as { item: WarrantyItem };
  return result.item;
}

async function documentToDataUrl(doc: WarrantyDocument) {
  if (doc.dataUrl) return doc.dataUrl;
  const source = doc.downloadUrl ?? doc.url;
  if (!source) return '';

  const response = await fetch(source);
  if (!response.ok) return '';
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getRemainingDays(endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function getStatus(endDate: string): WarrantyStatus {
  const days = getRemainingDays(endDate);
  if (days < 0) return 'expired';
  if (days <= 45) return 'expiring';
  return 'active';
}

function formatRemaining(endDate: string) {
  const days = getRemainingDays(endDate);
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return 'Expires today';
  if (days < 31) return `${days} days left`;
  const months = Math.floor(days / 30);
  const remainder = days % 30;
  return remainder > 0
    ? `${months} mo ${remainder} d left`
    : `${months} mo left`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function getCoveragePercent(item: WarrantyItem) {
  const start = new Date(`${item.purchaseDate}T00:00:00`).getTime();
  const end = new Date(`${item.warrantyEndDate}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return getStatus(item.warrantyEndDate) === 'expired' ? 100 : 0;
  }
  const elapsed = today.getTime() - start;
  return Math.min(
    100,
    Math.max(0, Math.round((elapsed / (end - start)) * 100)),
  );
}

function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('system');
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WarrantyStatus>(
    'all',
  );
  const [form, setForm] = useState<WarrantyForm>(emptyForm);
  const [documents, setDocuments] = useState<WarrantyDocument[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<WarrantyDocument | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const itemsRef = useRef<WarrantyItem[]>([]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('warranty-vault-theme');
    const initialTheme =
      savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
        ? savedTheme
        : 'system';
    setThemePreference(initialTheme);
    applyThemePreference(initialTheme);
  }, []);

  useEffect(() => {
    applyThemePreference(themePreference);
    window.localStorage.setItem('warranty-vault-theme', themePreference);

    if (themePreference !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => applyThemePreference('system');
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, [themePreference]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let ignore = false;

    loadWarrantyItems()
      .then((nextItems) => {
        if (ignore) return;
        setItems(nextItems);
        setSelectedId(nextItems[0]?.id ?? '');
        setLoadError('');
      })
      .catch(() => {
        if (ignore) return;
        setLoadError('Unable to load your warranty vault right now.');
      })
      .finally(() => {
        if (!ignore) setIsReady(true);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const startAdd = useCallback(() => {
    setForm(createBlankForm());
    setDocuments([]);
    setEditingId(null);
    setIsFormOpen(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();
    const buildTools = (): WebMcpTool[] => [
      {
        name: 'warranty_vault.get_summary',
        title: 'Get warranty summary',
        description:
          'Return counts, invoice value, and status totals for the warranty vault dashboard.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => {
          const currentItems = itemsRef.current;
          const counts = currentItems.reduce(
            (acc, item) => {
              acc[getStatus(item.warrantyEndDate)] += 1;
              return acc;
            },
            { active: 0, expiring: 0, expired: 0 },
          );

          return {
            totalItems: currentItems.length,
            activeWarranties: counts.active,
            expiringSoon: counts.expiring,
            expired: counts.expired,
            totalInvoiceValue: currentItems.reduce(
              (sum, item) => sum + item.invoiceAmount,
              0,
            ),
            currency: 'INR',
            documentsSaved: currentItems.reduce(
              (sum, item) => sum + item.documents.length,
              0,
            ),
          };
        },
      },
      {
        name: 'warranty_vault.search_items',
        title: 'Search warranty items',
        description:
          'Search warranty items by product, brand, category, store, contact, or status.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search text to match against item fields.',
            },
            status: {
              type: 'string',
              enum: ['all', 'active', 'expiring', 'expired'],
              description: 'Optional warranty status filter.',
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: (input) => {
          const queryText = readString(input, 'query').toLowerCase();
          const status = readString(input, 'status') || 'all';

          return itemsRef.current
            .filter((item) => {
              const itemStatus = getStatus(item.warrantyEndDate);
              const matchesStatus = status === 'all' || status === itemStatus;
              const haystack = [
                item.productName,
                item.brand,
                item.category,
                item.storeName,
                item.pointOfContact,
              ]
                .join(' ')
                .toLowerCase();

              return matchesStatus && haystack.includes(queryText);
            })
            .map(serializeItem);
        },
      },
      {
        name: 'warranty_vault.get_item',
        title: 'Get warranty item',
        description:
          'Return full details for one warranty item, excluding raw document file contents.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Warranty item ID returned by search_items.',
            },
          },
          required: ['id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: (input) => {
          const id = readString(input, 'id');
          const item = itemsRef.current.find((entry) => entry.id === id);
          return item ? serializeItem(item) : { error: 'Item not found' };
        },
      },
      {
        name: 'warranty_vault.list_documents',
        title: 'List warranty documents',
        description:
          'List supporting documents attached to warranty items, including document IDs needed to preview or download them.',
        inputSchema: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description:
                'Optional warranty item ID. When omitted, documents for all items are returned.',
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: (input) => {
          const itemId = readString(input, 'itemId');
          const currentItems = itemId
            ? itemsRef.current.filter((item) => item.id === itemId)
            : itemsRef.current;

          return currentItems.flatMap((item) =>
            item.documents.map((doc) => serializeDocument(item, doc)),
          );
        },
      },
      {
        name: 'warranty_vault.open_document_preview',
        title: 'Open document preview',
        description:
          'Open a supporting warranty document preview in the current page for the user.',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description:
                'Document ID returned by list_documents or get_item.',
            },
          },
          required: ['documentId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input) => {
          const documentId = readString(input, 'documentId');
          const match = findDocument(itemsRef.current, documentId);
          if (!match) return { error: 'Document not found' };

          setSelectedId(match.item.id);
          setPreviewDoc(match.document);
          return {
            opened: true,
            document: serializeDocument(match.item, match.document),
          };
        },
      },
      {
        name: 'warranty_vault.get_document_download',
        title: 'Get document download',
        description:
          'Return the selected supporting document with filename, MIME type, size, and data URL so an agent can view or download it.',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description:
                'Document ID returned by list_documents or get_item.',
            },
          },
          required: ['documentId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => {
          const documentId = readString(input, 'documentId');
          const match = findDocument(itemsRef.current, documentId);
          if (!match) return { error: 'Document not found' };
          const dataUrl = await documentToDataUrl(match.document);

          return {
            ...serializeDocument(match.item, match.document),
            downloadName: match.document.name,
            mimeType: match.document.type,
            dataUrl,
            downloadUrl: match.document.downloadUrl ?? match.document.url,
          };
        },
      },
      {
        name: 'warranty_vault.open_add_product_form',
        title: 'Open add product form',
        description:
          'Open the Warranty Vault add product form in the current page for the user.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: () => {
          startAdd();
          return { opened: true };
        },
      },
      {
        name: 'warranty_vault.create_item',
        title: 'Create warranty item',
        description:
          'Create a warranty item from structured purchase and coverage details, optionally including supporting document data URLs.',
        inputSchema: {
          type: 'object',
          properties: {
            productName: { type: 'string' },
            brand: { type: 'string' },
            category: { type: 'string' },
            purchaseDate: { type: 'string', format: 'date' },
            warrantyEndDate: { type: 'string', format: 'date' },
            invoiceAmount: {
              type: 'number',
              description: 'Invoice amount in Indian rupees.',
            },
            purchaseMode: { type: 'string', enum: ['online', 'offline'] },
            storeName: { type: 'string' },
            storeAddress: { type: 'string' },
            pointOfContact: { type: 'string' },
            notes: { type: 'string' },
            documents: {
              type: 'array',
              description:
                'Optional supporting documents such as invoices, bills, manuals, warranty cards, or product images. Each document must include a dataUrl.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: {
                    type: 'string',
                    description:
                      'MIME type, for example application/pdf or image/png.',
                  },
                  size: {
                    type: 'number',
                    description: 'File size in bytes, when known.',
                  },
                  dataUrl: {
                    type: 'string',
                    description:
                      'Data URL containing the document contents, used for preview and download.',
                  },
                },
                required: ['name', 'dataUrl'],
                additionalProperties: false,
              },
            },
          },
          required: ['productName', 'purchaseDate', 'warrantyEndDate'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const attachedDocuments = readDocuments(input);
          const item = await saveWarrantyItem(
            {
              productName:
                readString(input, 'productName') || 'Untitled product',
              brand: readString(input, 'brand'),
              category: readString(input, 'category'),
              purchaseDate: readString(input, 'purchaseDate') || daysFromNow(0),
              warrantyEndDate:
                readString(input, 'warrantyEndDate') || daysFromNow(365),
              invoiceAmount: readNumber(input, 'invoiceAmount'),
              purchaseMode: readPurchaseMode(input),
              storeName: readString(input, 'storeName'),
              storeAddress: readString(input, 'storeAddress'),
              pointOfContact: readString(input, 'pointOfContact'),
              notes: readString(input, 'notes'),
            },
            attachedDocuments,
            null,
          );

          setItems((current) => [item, ...current]);
          setSelectedId(item.id);
          return serializeItem(item);
        },
      },
      {
        name: 'warranty_vault.update_item',
        title: 'Update warranty item',
        description:
          'Update fields on an existing warranty item. Omitted fields are left unchanged, and existing supporting documents are preserved.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description:
                'Warranty item ID returned by search_items, get_item, or create_item.',
            },
            productName: { type: 'string' },
            brand: { type: 'string' },
            category: { type: 'string' },
            purchaseDate: { type: 'string', format: 'date' },
            warrantyEndDate: { type: 'string', format: 'date' },
            invoiceAmount: {
              type: 'number',
              description: 'Invoice amount in Indian rupees.',
            },
            purchaseMode: { type: 'string', enum: ['online', 'offline'] },
            storeName: { type: 'string' },
            storeAddress: { type: 'string' },
            pointOfContact: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const id = readString(input, 'id');
          const existing = itemsRef.current.find((item) => item.id === id);
          if (!existing) return { error: 'Item not found' };

          const updatedForm: WarrantyForm = {
            productName: hasInputField(input, 'productName')
              ? readString(input, 'productName') || existing.productName
              : existing.productName,
            brand: hasInputField(input, 'brand')
              ? readString(input, 'brand')
              : existing.brand,
            category: hasInputField(input, 'category')
              ? readString(input, 'category')
              : existing.category,
            purchaseDate: hasInputField(input, 'purchaseDate')
              ? readString(input, 'purchaseDate') || existing.purchaseDate
              : existing.purchaseDate,
            warrantyEndDate: hasInputField(input, 'warrantyEndDate')
              ? readString(input, 'warrantyEndDate') || existing.warrantyEndDate
              : existing.warrantyEndDate,
            invoiceAmount: hasInputField(input, 'invoiceAmount')
              ? readNumber(input, 'invoiceAmount')
              : existing.invoiceAmount,
            purchaseMode: hasInputField(input, 'purchaseMode')
              ? readPurchaseMode(input)
              : existing.purchaseMode,
            storeName: hasInputField(input, 'storeName')
              ? readString(input, 'storeName')
              : existing.storeName,
            storeAddress: hasInputField(input, 'storeAddress')
              ? readString(input, 'storeAddress')
              : existing.storeAddress,
            pointOfContact: hasInputField(input, 'pointOfContact')
              ? readString(input, 'pointOfContact')
              : existing.pointOfContact,
            notes: hasInputField(input, 'notes')
              ? readString(input, 'notes')
              : existing.notes,
          };
          const updatedItem = await saveWarrantyItem(
            updatedForm,
            existing.documents,
            existing.id,
          ).catch(() => null);

          if (!updatedItem) return { error: 'Unable to update item' };
          setItems((current) =>
            current.map((item) => (item.id === existing.id ? updatedItem : item)),
          );
          setSelectedId(updatedItem.id);
          return serializeItem(updatedItem);
        },
      },
      {
        name: 'warranty_vault.add_documents',
        title: 'Add supporting documents',
        description:
          'Attach supporting document data URLs to an existing warranty item so they can be previewed and downloaded later.',
        inputSchema: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description:
                'Warranty item ID returned by search_items or create_item.',
            },
            documents: {
              type: 'array',
              description:
                'Supporting documents such as invoices, bills, manuals, warranty cards, or product images.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: {
                    type: 'string',
                    description:
                      'MIME type, for example application/pdf or image/jpeg.',
                  },
                  size: {
                    type: 'number',
                    description: 'File size in bytes, when known.',
                  },
                  dataUrl: {
                    type: 'string',
                    description:
                      'Data URL containing the document contents, used for preview and download.',
                  },
                },
                required: ['name', 'dataUrl'],
                additionalProperties: false,
              },
            },
          },
          required: ['itemId', 'documents'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const itemId = readString(input, 'itemId');
          const attachedDocuments = readDocuments(input);
          if (attachedDocuments.length === 0) {
            return { error: 'No valid document data URLs were provided' };
          }

          const updatedItem = await addDocumentsToWarrantyItem(
            itemId,
            attachedDocuments,
          ).catch(() => null);
          if (!updatedItem) return { error: 'Item not found' };
          setItems((current) =>
            current.map((item) => (item.id === itemId ? updatedItem : item)),
          );
          setSelectedId(itemId);
          return serializeItem(updatedItem);
        },
      },
    ];

    const hosts = [document.modelContext, navigator.modelContext].filter(
      (host, index, allHosts): host is WebMcpHost =>
        Boolean(host?.registerTool) && allHosts.indexOf(host) === index,
    );
    const tools = buildTools();
    window.__warrantyVaultWebMCP = {
      status: hosts.length > 0 ? 'registered' : 'page-bridge-ready',
      tools,
      listTools: () => tools,
      executeTool: (name, input = {}) => {
        const tool = tools.find((entry) => entry.name === name);
        if (!tool) return { error: `Unknown tool: ${name}` };
        return tool.execute(input);
      },
    };
    window.warrantyVaultAgent = window.__warrantyVaultWebMCP;

    if (hosts.length === 0) {
      return () => {
        controller.abort();
        delete window.__warrantyVaultWebMCP;
        delete window.warrantyVaultAgent;
      };
    }

    Promise.all(
      hosts.flatMap((host) =>
        tools.map((tool) =>
          Promise.resolve(
            host.registerTool?.(tool, { signal: controller.signal }),
          ),
        ),
      ),
    ).catch(() => undefined);

    return () => {
      controller.abort();
      delete window.__warrantyVaultWebMCP;
      delete window.warrantyVaultAgent;
    };
  }, [isReady, startAdd]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = getStatus(item.warrantyEndDate);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const haystack = [
        item.productName,
        item.brand,
        item.category,
        item.storeName,
        item.pointOfContact,
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && haystack.includes(query.toLowerCase());
    });
  }, [items, query, statusFilter]);

  const selectedItem =
    items.find((item) => item.id === selectedId) ??
    filteredItems[0] ??
    items[0];

  const metrics = useMemo(() => {
    const counts = items.reduce(
      (acc, item) => {
        acc[getStatus(item.warrantyEndDate)] += 1;
        return acc;
      },
      { active: 0, expiring: 0, expired: 0 },
    );
    const totalValue = items.reduce((sum, item) => sum + item.invoiceAmount, 0);
    const documentsCount = items.reduce(
      (sum, item) => sum + item.documents.length,
      0,
    );

    return { ...counts, total: items.length, totalValue, documentsCount };
  }, [items]);

  const upcomingData = items
    .map((item) => ({
      name: item.productName,
      days: Math.max(0, getRemainingDays(item.warrantyEndDate)),
      status: getStatus(item.warrantyEndDate),
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  function updateForm<K extends keyof WarrantyForm>(
    key: K,
    value: WarrantyForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const acceptedFiles = Array.from(files).filter(
      (file) =>
        file.type.startsWith('image/') || file.type === 'application/pdf',
    );
    const loaded = await Promise.all(
      acceptedFiles.map(
        (file) =>
          new Promise<WarrantyDocument>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              if (typeof result !== 'string') {
                reject(new Error('Unable to read file as a data URL'));
                return;
              }
              resolve({
                id: crypto.randomUUID(),
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: result,
                uploadedAt: new Date().toISOString(),
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    setDocuments((current) => [...current, ...loaded]);
  }

  function resetForm() {
    setForm(emptyForm);
    setDocuments([]);
    setEditingId(null);
  }

  function startEdit(item: WarrantyItem) {
    const { id: _id, documents: itemDocuments, ...editable } = item;
    setForm(editable);
    setDocuments(itemDocuments);
    setEditingId(item.id);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setIsSaving(true);
    setLoadError('');

    try {
      const savedItem = await saveWarrantyItem(form, documents, editingId);
      setItems((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? savedItem : item))
          : [savedItem, ...current],
      );
      setSelectedId(savedItem.id);
      resetForm();
      setIsFormOpen(false);
    } catch {
      setLoadError('Unable to save this warranty item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    setLoadError('');
    try {
      await deleteWarrantyItem(itemId);
      setItems((current) => {
        const next = current.filter((item) => item.id !== itemId);
        setSelectedId(next[0]?.id ?? '');
        return next;
      });
    } catch {
      setLoadError('Unable to delete this warranty item. Please try again.');
    }
  }

  function removeDocument(docId: string) {
    setDocuments((current) => current.filter((doc) => doc.id !== docId));
  }

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f4_44%,#f9f3ea_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,#0b1220_0%,#111827_52%,#171717_100%)]">
        <div className="rounded-lg border border-white/70 bg-white/82 p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-card/82 dark:shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm dark:bg-emerald-300 dark:text-slate-950">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Warranty Vault</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Loading your coverage dashboard
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc_0%,#eef7f4_44%,#f9f3ea_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,#0b1220_0%,#111827_52%,#171717_100%)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-white/70 bg-white/72 px-4 py-4 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-5 lg:flex-row lg:items-center lg:justify-between dark:border-white/10 dark:bg-card/72 dark:shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm dark:bg-emerald-300 dark:text-slate-950">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                Personal coverage command center
              </p>
              <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
                Warranty Vault
              </h1>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ThemeToggle
              value={themePreference}
              onChange={setThemePreference}
            />
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, stores, contacts"
                className="h-11 rounded-lg border-white/70 bg-white/92 pl-9 shadow-sm dark:border-white/10 dark:bg-white/8"
              />
            </div>
            <Button
              type="button"
              onClick={startAdd}
              className="h-11 rounded-lg bg-slate-950 px-4 text-white shadow-sm hover:bg-slate-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200"
            >
              <Plus className="size-4" />
              Add Product
            </Button>
          </div>
        </header>

        {loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<PackageCheck className="size-5" />}
            label="Tracked items"
            value={String(metrics.total)}
            detail={`${metrics.documentsCount} documents saved`}
          />
          <MetricCard
            icon={<CheckCircle2 className="size-5" />}
            label="Active warranties"
            value={String(metrics.active)}
            detail="Covered and healthy"
          />
          <MetricCard
            icon={<Clock className="size-5" />}
            label="Expiring soon"
            value={String(metrics.expiring)}
            detail="Within 45 days"
            tone="amber"
          />
          <MetricCard
            icon={<FileText className="size-5" />}
            label="Invoice value"
            value={formatMoney(metrics.totalValue)}
            detail="Across all items"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="min-w-0 rounded-lg border border-white/70 bg-white/78 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-card/78 dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Warranty portfolio</h2>
                  <p className="text-sm text-muted-foreground">
                    Sort your products by coverage urgency.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'active', 'expiring', 'expired'] as const).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition ${
                          statusFilter === status
                            ? 'border-slate-950 bg-slate-950 text-white shadow-sm dark:border-emerald-300 dark:bg-emerald-300 dark:text-slate-950'
                            : 'border-white/80 bg-white/80 text-slate-600 shadow-sm hover:border-emerald-300 dark:border-white/10 dark:bg-white/8 dark:text-slate-300 dark:hover:border-emerald-300/60'
                        }`}
                      >
                        {status}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-white/15 dark:bg-white/5">
                  <PackageCheck className="mb-3 size-10 text-muted-foreground" />
                  <h3 className="text-base font-semibold">No items found</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Add a product or adjust your search to bring warranties back
                    into view.
                  </p>
                  <Button
                    type="button"
                    onClick={startAdd}
                    className="mt-4 rounded-lg bg-slate-950 text-white hover:bg-slate-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200"
                  >
                    <Plus className="size-4" />
                    Add Product
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredItems.map((item) => (
                    <WarrantyRow
                      key={item.id}
                      item={item}
                      isSelected={selectedItem?.id === item.id}
                      onSelect={() => setSelectedId(item.id)}
                      onEdit={() => startEdit(item)}
                      onDelete={() => removeItem(item.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-lg border border-white/70 bg-white/72 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-card/72 dark:shadow-[0_20px_60px_rgba(0,0,0,0.26)]">
              <h2 className="text-lg font-semibold">Next expirations</h2>
              <div className="mt-4 flex h-60 justify-center overflow-hidden">
                <BarChart
                  width={760}
                  height={236}
                  data={upcomingData}
                  layout="vertical"
                  margin={{ left: 18, right: 24 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                  />
                  <Tooltip />
                  <Bar dataKey="days" radius={[0, 6, 6, 0]} fill="#2f7f9f" />
                </BarChart>
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-white/70 bg-white/82 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-white/10 dark:bg-card/82 dark:shadow-[0_24px_70px_rgba(0,0,0,0.34)] xl:sticky xl:top-4 xl:self-start">
            {selectedItem ? (
              <ItemDetail
                item={selectedItem}
                onEdit={() => startEdit(selectedItem)}
                onPreview={setPreviewDoc}
              />
            ) : (
              <div className="flex min-h-96 flex-col items-center justify-center text-center">
                <ShieldCheck className="mb-3 size-11 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Select an item</h2>
                <p className="text-sm text-muted-foreground">
                  Product details and documents will appear here.
                </p>
              </div>
            )}
          </aside>
        </section>

        <AboutSection />
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm dark:bg-black/70">
          <div className="mx-auto my-4 max-w-4xl rounded-lg bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-card">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {editingId ? 'Edit warranty item' : 'Add warranty item'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Capture the purchase, coverage, contacts, and documents in
                    one place.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close form"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Product name" required>
                  <Input
                    required
                    value={form.productName}
                    onChange={(event) =>
                      updateForm('productName', event.target.value)
                    }
                    placeholder="MacBook Pro 14"
                  />
                </Field>
                <Field label="Brand">
                  <Input
                    value={form.brand}
                    onChange={(event) =>
                      updateForm('brand', event.target.value)
                    }
                    placeholder="Apple"
                  />
                </Field>
                <Field label="Category">
                  <Input
                    value={form.category}
                    onChange={(event) =>
                      updateForm('category', event.target.value)
                    }
                    placeholder="Laptop, appliance, phone"
                  />
                </Field>
                <Field label="Invoice amount (INR)">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.invoiceAmount || ''}
                    onChange={(event) =>
                      updateForm('invoiceAmount', Number(event.target.value))
                    }
                    placeholder="74999"
                  />
                </Field>
                <Field label="Purchase date" required>
                  <Input
                    required
                    type="date"
                    value={form.purchaseDate}
                    onChange={(event) =>
                      updateForm('purchaseDate', event.target.value)
                    }
                  />
                </Field>
                <Field label="Warranty end date" required>
                  <Input
                    required
                    type="date"
                    value={form.warrantyEndDate}
                    onChange={(event) =>
                      updateForm('warrantyEndDate', event.target.value)
                    }
                  />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <Field label="Purchase mode">
                  <div className="grid grid-cols-2 gap-2">
                    {(['online', 'offline'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateForm('purchaseMode', mode)}
                        className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium capitalize transition ${
                          form.purchaseMode === mode
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-300 dark:bg-emerald-300/18 dark:text-emerald-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-emerald-300/60'
                        }`}
                      >
                        {mode === 'online' ? (
                          <Laptop className="size-4" />
                        ) : (
                          <Store className="size-4" />
                        )}
                        {mode}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field
                  label={
                    form.purchaseMode === 'online' ? 'Platform' : 'Store name'
                  }
                >
                  <Input
                    value={form.storeName}
                    onChange={(event) =>
                      updateForm('storeName', event.target.value)
                    }
                    placeholder={
                      form.purchaseMode === 'online'
                        ? 'Amazon, Apple, Best Buy'
                        : 'Store name'
                    }
                  />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Store address">
                  <Textarea
                    value={form.storeAddress}
                    onChange={(event) =>
                      updateForm('storeAddress', event.target.value)
                    }
                    placeholder="Required for offline purchases"
                  />
                </Field>
                <Field label="Point of contact">
                  <Textarea
                    value={form.pointOfContact}
                    onChange={(event) =>
                      updateForm('pointOfContact', event.target.value)
                    }
                    placeholder="Name, email, phone, support URL"
                  />
                </Field>
              </div>

              <Field label="Notes" className="mt-4">
                <Textarea
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  placeholder="Service center terms, extended warranty notes, claim reminders"
                />
              </Field>

              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-white/5">
                <label
                  htmlFor="document-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg bg-white px-4 py-6 text-center transition hover:bg-emerald-50/60 dark:bg-white/6 dark:hover:bg-white/10"
                >
                  <Upload className="mb-2 size-7 text-emerald-700 dark:text-emerald-300" />
                  <span className="text-sm font-semibold">
                    Upload invoices, manuals, warranty cards, and product images
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    PDF and image files are stored with this warranty item.
                  </span>
                  <Input
                    id="document-upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,application/pdf"
                    className="sr-only"
                    onChange={(event) => handleFiles(event.target.files)}
                  />
                </label>
                {documents.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {documents.map((doc) => (
                      <DocumentChip
                        key={doc.id}
                        doc={doc}
                        onPreview={() => setPreviewDoc(doc)}
                        onRemove={() => removeDocument(doc.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200"
                  disabled={isSaving}
                >
                  <ShieldCheck className="size-4" />
                  {isSaving
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Save Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewDoc ? (
        <DocumentPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      ) : null}
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = 'emerald',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'emerald' | 'amber';
}) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/78 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-card/78 dark:shadow-[0_14px_40px_rgba(0,0,0,0.24)] dark:hover:shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-lg shadow-sm ${
            tone === 'amber'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-300/18 dark:text-amber-200'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-300/18 dark:text-emerald-200'
          }`}
        >
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-normal text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function ThemeToggle({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <div
      className="grid h-11 grid-cols-3 rounded-lg border border-white/70 bg-white/75 p-1 shadow-sm dark:border-white/10 dark:bg-white/8"
      aria-label="Theme preference"
    >
      {themeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex min-w-10 items-center justify-center rounded-md px-2 text-sm font-medium transition sm:min-w-11 ${
            value === option.value
              ? 'bg-slate-950 text-white shadow-sm dark:bg-emerald-300 dark:text-slate-950'
              : 'text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10'
          }`}
          aria-label={`Use ${option.label} theme`}
          title={`${option.label} theme`}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function AboutSection() {
  const highlights = [
    {
      title: 'Warranty memory',
      body: 'Keep purchase dates, expiry dates, invoices, warranty cards, manuals, and registration notes together.',
    },
    {
      title: 'Proof-first records',
      body: 'Documents stay attached to each product, so claim evidence is visible before long notes or service history.',
    },
    {
      title: 'Assistant-ready',
      body: 'The project includes a Warranty Vault Manager skill for guided agent workflows from email, invoices, and policy pages.',
    },
  ];

  return (
    <section className="rounded-lg border border-white/70 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] dark:border-emerald-300/20 dark:bg-slate-950/76 dark:shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">
            About Warranty Vault
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
            A personal coverage desk for everything you own.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Warranty Vault turns scattered invoices, warranty cards, manuals,
            and service contacts into one calm view. It is built for the moment
            when something breaks and you need dates, proof, and next steps
            fast.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Product manager: Amrita Neekhara
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-white/10 bg-white/8 p-4 dark:bg-white/6"
            >
              <h3 className="text-sm font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WarrantyRow({
  item,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  item: WarrantyItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getStatus(item.warrantyEndDate);
  const coveragePercent = getCoveragePercent(item);
  const documentsLabel =
    item.documents.length === 1
      ? '1 proof saved'
      : `${item.documents.length} proofs saved`;
  const barStyles = {
    active: 'bg-emerald-500',
    expiring: 'bg-amber-500',
    expired: 'bg-red-500',
  };
  const trackStyles = {
    active: 'bg-emerald-100 dark:bg-emerald-300/18',
    expiring: 'bg-amber-100 dark:bg-amber-300/18',
    expired: 'bg-red-100 dark:bg-red-300/18',
  };
  const healthLabel = {
    active: 'Healthy coverage',
    expiring: 'Watch soon',
    expired: 'Expired',
  };
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-lg border p-4 transition ${
        isSelected
          ? 'border-emerald-400 bg-emerald-50/70 shadow-[0_0_0_3px_rgba(16,185,129,0.10)] dark:border-emerald-300/70 dark:bg-emerald-300/12 dark:shadow-[0_0_0_3px_rgba(110,231,183,0.13)]'
          : 'border-white/70 bg-white/82 shadow-sm hover:border-emerald-200 hover:bg-white dark:border-white/10 dark:bg-white/7 dark:hover:border-emerald-300/40 dark:hover:bg-white/10'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug break-words [overflow-wrap:anywhere]">
              {item.productName}
            </h3>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 min-w-0 text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
            {item.brand || 'Unknown brand'} · {item.category || 'Uncategorized'}
          </p>
          <div className="mt-3">
            <div
              className={`h-2 overflow-hidden rounded-full ${trackStyles[status]}`}
            >
              <div
                className={`h-full rounded-full ${barStyles[status]}`}
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-foreground">
                {formatRemaining(item.warrantyEndDate)}
              </span>
              <span className="text-muted-foreground">
                Covered until {formatDate(item.warrantyEndDate)}
              </span>
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                {healthLabel[status]}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                {formatMoney(item.invoiceAmount)} invoice
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <CheckCircle2
                  className={`size-3.5 shrink-0 ${
                    item.documents.length
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-600 dark:text-amber-300'
                  }`}
                />
                {documentsLabel}
              </span>
            </div>
          </div>
        </button>
        <div className="flex shrink-0 gap-1 self-start rounded-lg bg-white/70 p-1 shadow-sm dark:bg-white/8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Edit item"
            onClick={onEdit}
          >
            <Edit3 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete item"
            onClick={onDelete}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-400/10 dark:hover:text-red-200"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function ItemDetail({
  item,
  onEdit,
  onPreview,
}: {
  item: WarrantyItem;
  onEdit: () => void;
  onPreview: (doc: WarrantyDocument) => void;
}) {
  const status = getStatus(item.warrantyEndDate);
  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
        <div>
          <StatusBadge status={status} />
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">
            {item.productName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {item.brand || 'Unknown brand'} · {item.category || 'Uncategorized'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Edit item"
          onClick={onEdit}
        >
          <Edit3 className="size-4" />
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DetailTile
          icon={<CalendarDays />}
          label="Purchased"
          value={formatDate(item.purchaseDate)}
        />
        <DetailTile
          icon={<Clock />}
          label="Warranty"
          value={formatRemaining(item.warrantyEndDate)}
        />
        <DetailTile
          icon={<FileText />}
          label="Invoice"
          value={formatMoney(item.invoiceAmount)}
        />
        <DetailTile
          icon={item.purchaseMode === 'online' ? <Laptop /> : <Store />}
          label="Source"
          value={item.purchaseMode}
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Documents</h3>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-300/18 dark:text-emerald-200">
            {item.documents.length} saved
          </span>
        </div>
        {item.documents.length ? (
          <div className="grid gap-2">
            {item.documents.map((doc) => (
              <DocumentChip
                key={doc.id}
                doc={doc}
                onPreview={() => onPreview(doc)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-5 text-center text-sm text-muted-foreground dark:border-white/15 dark:bg-white/5">
            Add invoices, manuals, warranty cards, or product images when
            editing this item.
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <InfoBlock
          label={item.purchaseMode === 'online' ? 'Platform' : 'Store'}
        >
          {item.storeName || 'Not recorded'}
        </InfoBlock>
        {item.purchaseMode === 'offline' ? (
          <InfoBlock label="Store address">
            {item.storeAddress || 'Not recorded'}
          </InfoBlock>
        ) : null}
        <InfoBlock label="Point of contact">
          {item.pointOfContact || 'Not recorded'}
        </InfoBlock>
        <CollapsibleNotes itemId={item.id} notes={item.notes} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WarrantyStatus }) {
  const styles = {
    active:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/18 dark:text-emerald-200',
    expiring:
      'bg-amber-100 text-amber-800 dark:bg-amber-300/18 dark:text-amber-200',
    expired: 'bg-red-100 text-red-700 dark:bg-red-300/18 dark:text-red-200',
  };
  const labels = {
    active: 'Active',
    expiring: 'Expiring soon',
    expired: 'Expired',
  };
  return <Badge className={styles[status]}>{labels[status]}</Badge>;
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/7">
      <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-300/18 dark:text-emerald-200">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold capitalize text-foreground">
        {value}
      </p>
    </div>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="rounded-lg border border-white/80 bg-white/70 p-3 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/7 dark:text-slate-200">
        {children}
      </p>
    </div>
  );
}

function CollapsibleNotes({
  itemId,
  notes,
}: {
  itemId: string;
  notes: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedNotes = notes.trim();
  const hasNotes = normalizedNotes.length > 0;
  const shouldCollapse = normalizedNotes.length > 220;

  useEffect(() => {
    setIsExpanded(false);
  }, [itemId]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Notes
        </p>
        {shouldCollapse ? (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        ) : null}
      </div>
      <p
        className={`rounded-lg border border-white/80 bg-white/70 p-3 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/7 dark:text-slate-200 ${
          shouldCollapse && !isExpanded
            ? 'max-h-24 overflow-hidden [mask-image:linear-gradient(180deg,#000_70%,transparent)]'
            : ''
        }`}
      >
        {hasNotes ? normalizedNotes : 'No notes yet.'}
      </p>
    </div>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function DocumentChip({
  doc,
  onPreview,
  onRemove,
}: {
  doc: WarrantyDocument;
  onPreview: () => void;
  onRemove?: () => void;
}) {
  const isImage = doc.type.startsWith('image/');
  const previewSource = doc.dataUrl ?? doc.url ?? '';
  const downloadSource = doc.downloadUrl ?? doc.dataUrl ?? doc.url ?? '#';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/80 bg-white/76 p-2 shadow-sm transition hover:border-emerald-200 hover:bg-white dark:border-white/10 dark:bg-white/7 dark:hover:border-emerald-300/40 dark:hover:bg-white/10">
      <button
        type="button"
        onClick={onPreview}
        className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-500 shadow-inner dark:bg-white/10 dark:text-slate-300"
        aria-label={`Preview ${doc.name}`}
      >
        {isImage ? (
          <Image
            src={previewSource}
            alt=""
            width={44}
            height={44}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <FileText className="size-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {doc.name}
        </p>
        <p className="text-xs text-muted-foreground">{fileSize(doc.size)}</p>
      </div>
      <a
        href={downloadSource}
        download={doc.name}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-300/12 dark:hover:text-emerald-200"
        aria-label={`Download ${doc.name}`}
      >
        <Download className="size-4" />
      </a>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex size-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10"
          aria-label={`Remove ${doc.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function DocumentPreview({
  doc,
  onClose,
}: {
  doc: WarrantyDocument;
  onClose: () => void;
}) {
  const isImage = doc.type.startsWith('image/');
  const isPdf = doc.type === 'application/pdf';
  const previewSource = doc.dataUrl ?? doc.url ?? '';
  const downloadSource = doc.downloadUrl ?? doc.dataUrl ?? doc.url ?? '#';
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 p-3 backdrop-blur-sm dark:bg-black/78">
      <div className="mx-auto flex h-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2">
            {isImage ? (
              <ImageIcon className="size-5" />
            ) : (
              <FileText className="size-5" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{doc.name}</p>
              <p className="text-xs text-muted-foreground">
                {fileSize(doc.size)}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <a
              href={downloadSource}
              download={doc.name}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Download className="size-4" />
              Download
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close preview"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3 dark:bg-slate-950/70">
          {isImage ? (
            <Image
              src={previewSource}
              alt={doc.name}
              width={1000}
              height={760}
              unoptimized
              className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
            />
          ) : null}
          {isPdf ? (
            <object
              data={previewSource}
              type="application/pdf"
              className="h-full w-full rounded-lg bg-white"
              aria-label={doc.name}
            >
              <p className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
                PDF preview is unavailable in this browser. Use download
                instead.
              </p>
            </object>
          ) : null}
          {!isImage && !isPdf ? (
            <div className="rounded-lg bg-white p-8 text-center text-sm text-slate-600 dark:bg-white/8 dark:text-slate-300">
              Preview is not available for this file type.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
