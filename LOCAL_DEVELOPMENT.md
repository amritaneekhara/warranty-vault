# Running Warranty Vault Locally

This project is a ChatGPT Sites app built with Vinext. Use this guide when you want to run, test, or build Warranty Vault on your machine.

## Requirements

- Node.js `22.13.0` or newer
- npm
- Project dependencies installed with `npm install`

## Install Dependencies

From the project root:

```bash
npm install
```

## Start The Development Server

```bash
npm run dev
```

Vinext will print a local URL, usually:

```text
http://localhost:3000
```

Open that URL in your browser to use the local app.

## Build For Production

```bash
npm run build
```

This creates the production build under `dist/`.

## Run The Production Worker Locally

After building:

```bash
npm run start
```

This starts the Cloudflare Worker-style runtime using:

```text
dist/server/wrangler.json
```

## Lint And Format

```bash
npm run lint
npm run format
```

## Local Storage Notes

The deployed site uses ChatGPT Sites-managed resources:

- D1 binding: `DB`
- R2 binding: `DOCUMENTS`

These are declared in `.openai/hosting.json`. In production, warranty records are stored in D1 and uploaded supporting documents are stored in R2.

When running locally with `npm run dev`, storage behavior depends on the local Sites/Vinext runtime bindings available on your machine. If D1/R2 bindings are unavailable, document upload and persistence may not match production exactly.

## Useful Project Files

- `app/page.tsx` - main Warranty Vault UI and browser WebMCP tools
- `app/api/_warranty-storage.ts` - D1/R2 persistence helpers
- `app/api/warranties/route.ts` - list and create warranty entries
- `app/api/warranties/[id]/route.ts` - update and delete warranty entries
- `app/api/warranties/[id]/documents/route.ts` - attach supporting documents
- `app/api/documents/[id]/route.ts` - preview/download supporting documents
- `db/schema.ts` - runtime schema setup
- `drizzle/0001_warranty_vault.sql` - database migration
- `.openai/hosting.json` - ChatGPT Sites project and binding metadata

## Common Workflow

```bash
npm install
npm run dev
npm run build
```

Use `npm run dev` while editing the UI. Run `npm run build` before publishing or when you want to verify the production bundle.
