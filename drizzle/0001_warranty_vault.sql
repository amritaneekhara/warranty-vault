CREATE TABLE IF NOT EXISTS warranty_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL,
  warranty_end_date TEXT NOT NULL,
  invoice_amount INTEGER NOT NULL DEFAULT 0,
  purchase_mode TEXT NOT NULL CHECK (purchase_mode IN ('online', 'offline')),
  store_name TEXT NOT NULL DEFAULT '',
  store_address TEXT NOT NULL DEFAULT '',
  point_of_contact TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warranty_documents (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES warranty_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warranty_items_user_updated
  ON warranty_items(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_warranty_documents_user_item
  ON warranty_documents(user_id, item_id);

CREATE INDEX IF NOT EXISTS idx_warranty_documents_user_id
  ON warranty_documents(user_id);

PRAGMA optimize;
