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
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type PurchaseMode = 'online' | 'offline';
type WarrantyStatus = 'active' | 'expiring' | 'expired';

type WarrantyDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
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

const storageKey = 'warranty-vault-items-v1';

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

const palette = {
  active: '#0f9f6e',
  expiring: '#d97706',
  expired: '#dc2626',
};

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createSampleItems(): WarrantyItem[] {
  return [
    {
      id: 'sample-laptop',
      productName: 'MacBook Pro 14',
      brand: 'Apple',
      category: 'Laptop',
      purchaseDate: daysFromNow(-250),
      warrantyEndDate: daysFromNow(115),
      invoiceAmount: 1999,
      purchaseMode: 'online',
      storeName: 'Apple Store Online',
      storeAddress: '',
      pointOfContact: 'support.apple.com',
      notes: 'AppleCare quote saved with the invoice.',
      documents: [],
    },
    {
      id: 'sample-camera',
      productName: 'Alpha Mirrorless Camera',
      brand: 'Sony',
      category: 'Camera',
      purchaseDate: daysFromNow(-680),
      warrantyEndDate: daysFromNow(22),
      invoiceAmount: 1280,
      purchaseMode: 'offline',
      storeName: 'Downtown Photo Center',
      storeAddress: '118 Market Street',
      pointOfContact: 'Rina, service desk',
      notes: 'Warranty extension decision due this month.',
      documents: [],
    },
    {
      id: 'sample-washer',
      productName: 'Front Load Washer',
      brand: 'LG',
      category: 'Appliance',
      purchaseDate: daysFromNow(-1180),
      warrantyEndDate: daysFromNow(-45),
      invoiceAmount: 749,
      purchaseMode: 'offline',
      storeName: 'HomePlus Appliances',
      storeAddress: '42 North Avenue',
      pointOfContact: 'Store warranty counter',
      notes: 'Motor warranty may be separate from full appliance coverage.',
      documents: [],
    },
  ];
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
  return remainder > 0 ? `${months} mo ${remainder} d left` : `${months} mo left`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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

function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [items, setItems] = useState<WarrantyItem[]>(() => {
    if (typeof window === 'undefined') return createSampleItems();
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as WarrantyItem[]) : createSampleItems();
  });
  const [selectedId, setSelectedId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WarrantyStatus>('all');
  const [form, setForm] = useState<WarrantyForm>(emptyForm);
  const [documents, setDocuments] = useState<WarrantyDocument[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<WarrantyDocument | null>(null);

  useEffect(() => {
    if (items.length > 0) {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items]);

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
    items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0];

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

  const pieData = [
    { name: 'Active', value: metrics.active, color: palette.active },
    { name: 'Expiring', value: metrics.expiring, color: palette.expiring },
    { name: 'Expired', value: metrics.expired, color: palette.expired },
  ].filter((entry) => entry.value > 0);

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
      (file) => file.type.startsWith('image/') || file.type === 'application/pdf',
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

  function startAdd() {
    resetForm();
    setIsFormOpen(true);
  }

  function startEdit(item: WarrantyItem) {
    const { id: _id, documents: itemDocuments, ...editable } = item;
    setForm(editable);
    setDocuments(itemDocuments);
    setEditingId(item.id);
    setIsFormOpen(true);
  }

  function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const normalized: WarrantyItem = {
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
      id: editingId ?? crypto.randomUUID(),
    };

    if (editingId) {
      setItems((current) =>
        current.map((item) => (item.id === editingId ? normalized : item)),
      );
    } else {
      setItems((current) => [normalized, ...current]);
    }

    setSelectedId(normalized.id);
    resetForm();
    setIsFormOpen(false);
  }

  function removeItem(itemId: string) {
    setItems((current) => {
      const next = current.filter((item) => item.id !== itemId);
      setSelectedId(next[0]?.id ?? '');
      return next;
    });
  }

  function removeDocument(docId: string) {
    setDocuments((current) => current.filter((doc) => doc.id !== docId));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e7f8f1_0,#f7faf7_34%,#f6f3ee_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-700">
                Personal coverage command center
              </p>
              <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                Warranty Vault
              </h1>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, stores, contacts"
                className="h-10 rounded-lg border-slate-300 bg-white/85 pl-9"
              />
            </div>
            <Button
              onClick={startAdd}
              className="h-10 bg-emerald-700 px-4 text-white hover:bg-emerald-800"
            >
              <Plus className="size-4" />
              Add Product
            </Button>
          </div>
        </header>

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
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <section className="rounded-lg border border-slate-200 bg-white/88 p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Warranty portfolio</h2>
                  <p className="text-sm text-slate-500">
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
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition ${
                          statusFilter === status
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'
                        }`}
                      >
                        {status}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <PackageCheck className="mb-3 size-10 text-slate-400" />
                  <h3 className="text-base font-semibold">No items found</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Add a product or adjust your search to bring warranties back
                    into view.
                  </p>
                  <Button
                    onClick={startAdd}
                    className="mt-4 bg-emerald-700 text-white hover:bg-emerald-800"
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

            <section className="grid content-start gap-5">
              <div className="rounded-lg border border-slate-200 bg-white/88 p-4 shadow-sm">
                <h2 className="text-lg font-semibold">Coverage mix</h2>
                <div className="mt-2 h-60">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={
                          pieData.length
                            ? pieData
                            : [{ name: 'None', value: 1, color: '#cbd5e1' }]
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={4}
                        fill={pieData[0]?.color ?? '#cbd5e1'}
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Legend label="Active" color={palette.active} value={metrics.active} />
                  <Legend
                    label="Expiring"
                    color={palette.expiring}
                    value={metrics.expiring}
                  />
                  <Legend label="Expired" color={palette.expired} value={metrics.expired} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white/88 p-4 shadow-sm">
                <h2 className="text-lg font-semibold">Next expirations</h2>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={upcomingData} layout="vertical" margin={{ left: 12 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={96}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: '#475569' }}
                      />
                      <Tooltip />
                      <Bar dataKey="days" radius={[0, 6, 6, 0]} fill="#2f7f9f" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white/92 p-4 shadow-sm">
            {selectedItem ? (
              <ItemDetail
                item={selectedItem}
                onEdit={() => startEdit(selectedItem)}
                onPreview={setPreviewDoc}
              />
            ) : (
              <div className="flex min-h-96 flex-col items-center justify-center text-center">
                <ShieldCheck className="mb-3 size-11 text-slate-300" />
                <h2 className="text-lg font-semibold">Select an item</h2>
                <p className="text-sm text-slate-500">
                  Product details and documents will appear here.
                </p>
              </div>
            )}
          </aside>
        </section>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm">
          <div className="mx-auto my-4 max-w-4xl rounded-lg bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {editingId ? 'Edit warranty item' : 'Add warranty item'}
                  </h2>
                  <p className="text-sm text-slate-500">
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
                    onChange={(event) => updateForm('brand', event.target.value)}
                    placeholder="Apple"
                  />
                </Field>
                <Field label="Category">
                  <Input
                    value={form.category}
                    onChange={(event) => updateForm('category', event.target.value)}
                    placeholder="Laptop, appliance, phone"
                  />
                </Field>
                <Field label="Invoice amount">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.invoiceAmount || ''}
                    onChange={(event) =>
                      updateForm('invoiceAmount', Number(event.target.value))
                    }
                    placeholder="1299"
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
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
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
                <Field label={form.purchaseMode === 'online' ? 'Platform' : 'Store name'}>
                  <Input
                    value={form.storeName}
                    onChange={(event) =>
                      updateForm('storeName', event.target.value)
                    }
                    placeholder={form.purchaseMode === 'online' ? 'Amazon, Apple, Best Buy' : 'Store name'}
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

              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <label
                  htmlFor="document-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg bg-white px-4 py-6 text-center"
                >
                  <Upload className="mb-2 size-7 text-emerald-700" />
                  <span className="text-sm font-semibold">
                    Upload invoices, manuals, warranty cards, and product images
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    PDF and image files are saved in this browser for the prototype.
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
                <Button className="bg-emerald-700 text-white hover:bg-emerald-800">
                  <ShieldCheck className="size-4" />
                  {editingId ? 'Save Changes' : 'Save Product'}
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
    <div className="rounded-lg border border-slate-200 bg-white/88 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-lg ${
            tone === 'amber'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
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
  return (
    <article
      className={`rounded-lg border bg-white p-3 transition ${
        isSelected
          ? 'border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" onClick={onSelect} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{item.productName}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {item.brand || 'Unknown brand'} · {item.category || 'Uncategorized'}
          </p>
        </button>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[430px]">
          <MiniFact label="Remaining" value={formatRemaining(item.warrantyEndDate)} />
          <MiniFact label="Ends" value={formatDate(item.warrantyEndDate)} />
          <MiniFact label="Invoice" value={formatMoney(item.invoiceAmount)} />
          <MiniFact label="Docs" value={String(item.documents.length)} />
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Edit item" onClick={onEdit}>
            <Edit3 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete item"
            onClick={onDelete}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusBadge status={status} />
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">
            {item.productName}
          </h2>
          <p className="text-sm text-slate-500">
            {item.brand || 'Unknown brand'} · {item.category || 'Uncategorized'}
          </p>
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Edit item" onClick={onEdit}>
          <Edit3 className="size-4" />
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DetailTile icon={<CalendarDays />} label="Purchased" value={formatDate(item.purchaseDate)} />
        <DetailTile icon={<Clock />} label="Warranty" value={formatRemaining(item.warrantyEndDate)} />
        <DetailTile icon={<FileText />} label="Invoice" value={formatMoney(item.invoiceAmount)} />
        <DetailTile
          icon={item.purchaseMode === 'online' ? <Laptop /> : <Store />}
          label="Source"
          value={item.purchaseMode}
        />
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <InfoBlock label={item.purchaseMode === 'online' ? 'Platform' : 'Store'}>
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
        <InfoBlock label="Notes">{item.notes || 'No notes yet.'}</InfoBlock>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Documents</h3>
          <span className="text-xs text-slate-500">
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
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
            Add invoices, manuals, warranty cards, or product images when editing
            this item.
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WarrantyStatus }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-800',
    expiring: 'bg-amber-100 text-amber-800',
    expired: 'bg-red-100 text-red-700',
  };
  const labels = {
    active: 'Active',
    expiring: 'Expiring soon',
    expired: 'Expired',
  };
  return <Badge className={styles[status]}>{labels[status]}</Badge>;
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <p className="truncate font-semibold text-slate-800">{value}</p>
    </div>
  );
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
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-white text-emerald-700">
        {icon}
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold capitalize text-slate-900">
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
      <p className="mb-1 text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{children}</p>
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
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
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
      <button
        type="button"
        onClick={onPreview}
        className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-500"
        aria-label={`Preview ${doc.name}`}
      >
        {isImage ? (
          <Image
            src={doc.dataUrl}
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
        <p className="truncate text-sm font-semibold">{doc.name}</p>
        <p className="text-xs text-slate-500">{fileSize(doc.size)}</p>
      </div>
      <a
        href={doc.dataUrl}
        download={doc.name}
        className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        aria-label={`Download ${doc.name}`}
      >
        <Download className="size-4" />
      </a>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex size-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
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
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3">
          <div className="flex min-w-0 items-center gap-2">
            {isImage ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{doc.name}</p>
              <p className="text-xs text-slate-500">{fileSize(doc.size)}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <a
              href={doc.dataUrl}
              download={doc.name}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-slate-100"
            >
              <Download className="size-4" />
              Download
            </a>
            <Button type="button" variant="ghost" size="icon" aria-label="Close preview" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
          {isImage ? (
            <Image
              src={doc.dataUrl}
              alt={doc.name}
              width={1000}
              height={760}
              unoptimized
              className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
            />
          ) : null}
          {isPdf ? (
            <object
              data={doc.dataUrl}
              type="application/pdf"
              className="h-full w-full rounded-lg bg-white"
              aria-label={doc.name}
            >
              <p className="p-6 text-center text-sm text-slate-600">
                PDF preview is unavailable in this browser. Use download instead.
              </p>
            </object>
          ) : null}
          {!isImage && !isPdf ? (
            <div className="rounded-lg bg-white p-8 text-center text-sm text-slate-600">
              Preview is not available for this file type.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Legend({
  label,
  color,
  value,
}: {
  label: string;
  color: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <span
        className="mx-auto mb-1 block size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <p className="font-semibold text-slate-800">{value}</p>
      <p className="text-slate-500">{label}</p>
    </div>
  );
}
