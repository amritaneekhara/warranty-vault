---
name: warranty-vault-manager
description: Register, update, audit, and attach documents for product warranties using Gmail and Warranty Vault.
metadata:
  short-description: Manage product warranties from Gmail in Warranty Vault
---

# Warranty Vault Manager

Use this skill when the user asks to register, update, audit, or attach documents for product warranties using Gmail, product emails, invoices, warranty pages, or Warranty Vault.

Target system:
Use `https://warranty-vault.nlpwire.chatgpt.site/` as the default Warranty Vault system of record unless the user provides a different vault URL.

## Workflow

When registering or updating a product warranty from email:

1. Search Gmail for the relevant product, brand, store, order, invoice, warranty, or policy email.
2. Read the email body and all relevant attachments.
3. Extract product name, brand, category, purchase date, seller or store, invoice amount, order ID, invoice number, warranty contact, warranty period, and warranty end date.
4. If the email contains a warranty-policy link, open that link, read the policy page, summarize the warranty, return, replacement, cancellation, claim, and support terms, convert that policy text into a PDF, and attach it as a supporting document.
5. If the email has an invoice, bill, warranty card, product image, manual, registration confirmation, or other supporting attachment, download it locally if needed, convert or upload it as a supporting document, and verify it appears in Warranty Vault.
6. Open Warranty Vault in the in-app browser.
7. Search for an existing matching item before creating a new one.
8. Create or update the matching Warranty Vault item with the extracted product and warranty details.
9. Attach all relevant supporting documents, including invoice, bill, warranty card, policy PDF, manual, product image, registration confirmation, and claim instructions.
10. Verify the saved item, document count, warranty end date, status, and key notes before reporting completion.

## Approval Rules

Ask the user only for required approvals:

- Before submitting sensitive personal, contact, address, or order data to Warranty Vault.
- Before uploading invoices, warranty cards, or documents containing personal data.
- Before downloads that require network permission.
- Before deletes, purchases, account changes, or genuinely ambiguous choices.

Do not stop for routine intermediate decisions such as whether to download then upload an attachment, whether to follow a warranty-policy link from an email, or whether to convert policy text into a PDF. Those actions are part of this workflow.

## Document Handling

Prefer attaching original source documents when available. When a policy page is only available as HTML, create a concise PDF that includes:

- Source URL and access date.
- Warranty duration or coverage period when stated.
- Eligibility and claim requirements.
- Exclusions and conditions that can void coverage.
- Return, replacement, cancellation, and refund terms when present.
- Support contact and service hours when present.

Keep generated filenames descriptive, such as `brand-product-invoice.pdf` or `brand-warranty-policy.pdf`.

## Verification

Before reporting done, verify through Warranty Vault that:

- The item exists and is not duplicated.
- The purchase date and warranty end date are correct.
- The item status matches the dates.
- Every intended supporting document appears in the document list.
- Notes include enough source detail to trace the warranty later.
