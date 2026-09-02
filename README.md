# Warranty Vault

Warranty Vault is a personal warranty management web app for tracking products, purchase details, warranty coverage, invoices, manuals, warranty cards, and other supporting documents in one place.

The app is designed for everyday product ownership: when a device breaks, expires, or needs service, Warranty Vault helps the user quickly find the warranty status, remaining coverage period, purchase source, support contact, and proof documents needed for a claim.

## Product Manager

Warranty Vault is product-managed by **Amrita Neekhara**. The product direction emphasizes practical consumer workflows, proof-first warranty records, agent-assisted document handling, and a clean experience for managing personal product coverage.

## Key Features

- Add purchased products with brand, category, purchase date, warranty end date, and invoice amount.
- Track online and offline purchase sources, including store/platform name and address.
- Save support contact details such as names, phone numbers, emails, or support links.
- Upload supporting documents such as invoices, bills, warranty cards, manuals, PDFs, and product images.
- Preview and download saved warranty documents.
- View warranty status, remaining warranty period, and upcoming expirations.
- Search and filter warranty items by status.
- Use an agent-friendly WebMCP interface from the Codex in-app browser.

## Tech Stack

- Vinext
- React
- Tailwind CSS
- shadcn UI components
- Recharts
- ChatGPT Sites
- Cloudflare D1 for warranty metadata
- Cloudflare R2 for supporting documents

## Local Development

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for local setup, development, build, and storage notes.

Basic workflow:

```bash
npm install
npm run dev
npm run build
```

## Human User Guide

See [USER_HELP_GUIDE.md](./USER_HELP_GUIDE.md) for a nontechnical guide covering dashboard usage, adding products, attaching documents, previewing/downloading files, and managing notes.

## WebMCP Tools

Warranty Vault exposes browser-scoped WebMCP tools for agents when the site is opened in the Codex in-app browser. These tools let an agent inspect warranty records, create entries, update entries, and work with supporting documents without relying only on visual clicking.

The current browser WebMCP tool set includes:

- `warranty_vault.get_summary`
- `warranty_vault.search_items`
- `warranty_vault.get_item`
- `warranty_vault.list_documents`
- `warranty_vault.open_document_preview`
- `warranty_vault.get_document_download`
- `warranty_vault.open_add_product_form`
- `warranty_vault.create_item`
- `warranty_vault.update_item`
- `warranty_vault.add_documents`

### What Agents Can Do

Agents can:

- Search for existing warranty records before creating duplicates.
- Create warranty entries from structured purchase and coverage data.
- Update existing product, warranty, purchase, invoice, store, contact, and notes fields.
- Attach supporting documents using data URLs.
- List attached documents.
- Preview a document in the page.
- Retrieve a document as a data URL for download or inspection.

### WebMCP Scope

The WebMCP tools are scoped to the browser/page session. They are intended to be used from the Codex in-app browser when the Warranty Vault page is open.

They are not the same as globally installed chat tools. A Codex chat session cannot call them by name unless the active browser tab exposes them through the browser WebMCP capability.

## Using WebMCP With Codex In-App Browser

1. Open Warranty Vault in the Codex in-app browser.
2. Let the page load until the dashboard is visible.
3. Ask Codex to inspect the page tools or use the Warranty Vault tools.
4. Codex can fetch the page-defined WebMCP tools from the active tab.
5. Codex can call a listed tool such as `warranty_vault.search_items` or `warranty_vault.create_item`.

Example user request:

```text
Use the in-app browser and add this product warranty to Warranty Vault.
Search first to avoid duplicates, then attach the invoice PDF.
```

Example agent flow:

1. Open the live Warranty Vault page.
2. Fetch WebMCP tools from the active browser tab.
3. Call `warranty_vault.search_items` to check for an existing product.
4. Call `warranty_vault.create_item` or `warranty_vault.update_item`.
5. Call `warranty_vault.add_documents` if supporting files need to be attached separately.
6. Call `warranty_vault.get_item` or inspect the page to verify the saved record.

## Gmail-To-Warranty Use Case

Warranty Vault is designed to work well with an email-assisted workflow. If a user connects a Gmail plugin or makes Gmail available to Codex, an agent can help register warranties from purchase or warranty emails.

Example request:

```text
Use Gmail to find the Portronics warranty email, extract the product details,
and add the item to Warranty Vault with the invoice and warranty documents.
```

Recommended agent workflow:

1. Search Gmail for the product, brand, store, order ID, invoice, warranty, or policy email.
2. Read the relevant email and attachments.
3. Extract product name, brand, category, purchase date, seller/store, invoice amount, order ID, warranty period, warranty end date, and support contact.
4. Download or prepare supporting documents such as invoices, bills, warranty cards, product images, manuals, or policy PDFs.
5. Open Warranty Vault in the Codex in-app browser.
6. Search Warranty Vault for an existing matching item.
7. Create or update the warranty record.
8. Attach all relevant supporting documents.
9. Verify the saved item and document count.

Agents should ask for user approval before uploading invoices, warranty cards, or other documents containing personal data.

## Included Codex Skill

This repository includes a reusable Codex skill:

```text
skills/warranty-vault-manager/
```

The skill helps Codex follow a consistent workflow for registering, updating, auditing, and attaching product warranty documents using Gmail, warranty emails, invoices, policy pages, and Warranty Vault.

### Skill Files

- `skills/warranty-vault-manager/SKILL.md`
- `skills/warranty-vault-manager/agents/openai.yaml`

### Where To Add The Skill

For a Codex user, copy or keep the skill folder under the Codex skills directory:

```text
<CODEX_HOME>/skills/warranty-vault-manager/
```

On this Windows setup, that commonly maps to:

```text
C:\Users\<YourUser>\.codex\skills\warranty-vault-manager\
```

After the skill is available, a user can ask Codex to use the Warranty Vault Manager workflow for tasks such as:

```text
Use the Warranty Vault Manager skill to register a warranty from Gmail.
```

or:

```text
Find the warranty email for this product, extract the details, and add it to Warranty Vault with supporting documents.
```

## Privacy And Public Repository Notes

This repository is intended to be safe for public source sharing. Avoid committing real customer invoices, warranty cards, bills, personal documents, or product images.

The `.gitignore` excludes local PDFs and common image formats so supporting proof documents are not accidentally committed.

If you publish your own copy, review `.openai/hosting.json`. It contains project metadata and logical storage binding names, not secrets, but you may prefer to replace it with an example file for a public template.

## Acknowledgements

Warranty Vault was designed and developed with support from **Codex** and **OpenAI**, including rapid prototyping, implementation assistance, deployment support, and agent workflow exploration.

Product management and product direction: **Amrita Neekhara**.
