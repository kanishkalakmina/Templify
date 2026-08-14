# Templify — Product Specification

**Status:** Accepted · **Level:** 3 · **Author:** Stakeholder (Lakmina Egodawatthe)
**Captured:** 2026-08-14 · **Serves as:** Phase 2 PRD

> This document is a structural capture of the stakeholder's 39-section brief. It is the
> source of truth for scope. Where the brief fixed an implementation detail (the template
> schema, the colour palette, the endpoint list), that detail is reproduced here rather
> than re-derived.

---

## 1. Product thesis

> **The customer's application owns the data. Templify owns the document design.**

A calling application POSTs a `templateId` plus a `data` payload. Templify renders the
final document. The application never contains layout, styling, logo handling, table
code or PDF logic.

**The pain being removed:**

| Traditional | With Templify |
| --- | --- |
| App holds data **+ PDF code + layout + styling + logo + tables + report logic** | App holds **data** |
| Design change → developer → code change → build → deploy | Design change → open editor → save → done |

Every screen must serve this message. The demonstration that proves it is
**"Same Data. Different Design."** (§22): one payload, a template dropdown, a preview that
changes design while the data stays put.

### Canonical request

```json
{
  "templateId": "invoice-modern",
  "data": {
    "company":  { "name": "Acme Technologies", "logo": "/logo.png", "email": "hello@acme.com", "phone": "+94 77 123 4567", "address": "Colombo, Sri Lanka" },
    "customer": { "name": "John Doe", "email": "john@example.com", "address": "Colombo, Sri Lanka" },
    "invoice":  { "number": "INV-1001", "date": "2026-08-14", "dueDate": "2026-08-30", "subtotal": 50000, "discount": 0, "tax": 0, "total": 50000 },
    "items":    [{ "name": "Website Development", "quantity": 1, "price": 50000, "total": 50000 }]
  }
}
```

## 2. Scope

**In scope:** templates · template editing · data binding · preview · template versions ·
template management · API integration concept.

**Explicitly out of scope — do not build:** email, monitoring, payments, CRM features.

**Nature of the deliverable:** a real interactive frontend prototype, not a static mockup.
Backend operations are mocked locally; state persists to `localStorage`.

## 3. Priority order

Effort is allocated in this order (§38). Decorative dashboard work is explicitly deprioritised.

1. Template Editor ← *the most important screen*
2. Template Library
3. Data binding
4. Test data
5. Preview
6. Versioning
7. API concept
8. Dashboard

## 4. Functional requirements

### FR-1 Application shell
Persistent sidebar: Dashboard · Templates · Template Library · API · Settings.
The editor opens as its own full workspace with a specialised layout.

### FR-2 Dashboard
Greeting header; stat tiles (Templates 24 / Active 18 / Reports Generated 12,842 /
Template Versions 67); recent templates; quick actions (New Template, Browse Library,
API Documentation); recent activity feed.

### FR-3 Template management
Search, category filters (All/Invoices/Quotations/Receipts/Reports/Certificates/HR/Other),
cards bearing **real preview thumbnails**. Per-template actions: Edit, Preview, Duplicate,
Rename, Delete, Archive, Version history.

### FR-4 Template Library
Users must never start from a blank page. Built-in catalogue across Invoices (6),
Quotations (3), Receipts (3), Business Reports (4), Certificates (3), HR (3), Other (4).
Badges distinguish **Built-in** from **Custom**.

> **Invariant:** built-in templates are never mutated. Selecting one duplicates it into the
> user's own templates via a name + template-ID prompt.

### FR-5 Create template
Name · Template ID (unique, validated) · Category · Description · Page Size · Orientation ·
Start From (Browse Templates | Start Blank).

### FR-6 Template Editor
Three-pane workspace: component library (left) · canvas (centre) · properties (right).
Top bar carries breadcrumb, name, version, undo, redo, save state, Test Data, Preview,
Save, template settings.

**Canvas:** A4/A5/Letter, portrait/landscape, margins, rulers, grid, snap-to-grid,
alignment guides, drag, resize, multi-select, copy, paste, duplicate, delete, group,
ungroup, layer ordering. Zoom 25–150% plus Fit. Selected elements show a thin accent
border, resize handles and a floating toolbar (Duplicate, Align, Move Forward, Move Back,
Delete).

**Component library:** Basic (Text, Heading, Rich Text, Image, Logo, Divider, Spacer) ·
Data (Table, Data Grid, Repeater, Key/Value, List) · Visual (Chart, KPI Card, Progress Bar,
Badge) · Utilities (QR Code, Barcode, Page Number, Date, Signature) · Layout (Container,
Columns, Section, Header, Footer). Every component is draggable onto the canvas.

**Properties panel** (collapsible sections): Layout · Typography · Appearance · Data ·
Conditional Display.

### FR-7 Data binding
`{{path}}` tokens resolved against the applied data. `Insert Variable` opens a searchable
tree derived from the test data (company/customer/invoice/`items[]`). Clicking
`customer.name` inserts `{{customer.name}}`. Bindings render with subtle accent styling in
the editor.

### FR-8 Repeating data and tables
Arrays are bound through UI, not hand-written loops: a `Repeat Data` source picker, with
row-scoped `{{item.*}}` tokens and a clear visual marker that the row repeats. The table
editor supports add/remove/reorder/resize columns, header styling, row styling,
alternating rows, borders, alignment and number formatting.

### FR-9 Test data
A JSON editor drawer with the canonical payload, `Reset` and `Apply Data`. Applying must
update the document **immediately** — changing `customer.name` to `John Smith` visibly
changes the invoice.

### FR-10 Preview
Editor chrome drops away; the white document sits centred on the dark workspace.
`Download PDF` / `Download HTML` show a toast:
*"PDF rendering is connected in the server implementation."*

> **Honesty constraint:** do not fake a generated PDF when no renderer exists.

### FR-11 Versioning
Per-template version list with current-version indicator; create, view, restore.
Applications may address `invoice-modern` or pin `invoice-modern:v2`, so a design change
cannot break a live integration.

### FR-12 Same Data, Different Design
Dedicated demonstration screen with a template dropdown over one fixed payload.

### FR-13 Import / export
`.templify` file carrying metadata, layout, elements, styles, data bindings, page settings
and variables.

> **Invariant:** never export production or customer data with a template.

### FR-14 API page
Developer documentation for `POST /api/reports/render` plus template CRUD
(`POST/GET/GET :id/PUT :id/DELETE :id`), with request/response bodies, code examples and
copy buttons.

### FR-15 Self-hosted / Docker page
UI-only representation: `docker run` snippet, server status, server URL, version.
No actual Docker control from the frontend.

### FR-16 Template settings
Name, ID, category, description, page size, orientation, margins, default font, default
colours; branding block for primary/secondary colour, default logo, default footer.

### FR-17 Keyboard shortcuts
Undo, Redo, Save, Delete, Duplicate, Copy, Paste — with hints surfaced in tooltips.

### FR-18 Empty states, toasts
Purposeful empty states (no templates / no variables / no versions) and subtle toasts for
saved, logo updated, version created, duplicated, restored, data applied, variable inserted.

## 5. The flow that must feel polished (§33)

Library → browse → preview Invoice Modern → Use Template → name + ID → editor → change
logo → restyle customer name → move element → insert `customer.name` → open Test Data →
change the name → Apply → **document updates immediately** → select table → add column →
Preview → Save → creates v4 → integrate via `my-invoice`.

## 6. Non-functional requirements

- **Desktop-first editor.** Small viewports get a clear "optimised for desktop" message.
  Dashboard and template pages remain responsive.
- **Dark by default.** Chrome `#0B0D10` app / `#101318` sidebar / `#11151A` toolbar /
  `#151A20` panel / `#1B2129` hover / `#252B33` border; text `#F5F7FA` / `#9AA3AF` /
  `#68717E`. Subtle blue-violet accent, used sparingly.
- **Critical visual rule:** the application UI is dark; the report canvas is white.
  Dialogs, dropdowns, tooltips and property panels are all dark.
- **Persistence:** templates and mock data survive a browser refresh.
- **Runs with `npm install && npm run dev`, with no backend.**

## 7. Architectural constraints (binding)

- No giant `App.tsx`; no single-file editor; no duplicated components; no files split for
  splitting's sake. One clear responsibility per module.
- Keep **UI / state / template schema / data binding / rendering / API** separate.
- **The template schema must not depend on React.** The editor operates on the schema.
- An invoice is *just data + elements* expressed in the generic schema — no
  invoice-specific logic inside the editor. The same editor must later serve Quotation,
  Receipt, Certificate, Payslip, Audit Report, Financial Report, Purchase Order,
  Delivery Note and Custom Report without a rewrite.

## 8. Fixed schema (from the brief)

```typescript
type ReportTemplate = {
  id: string; name: string; category: string; version: number;
  page: PageSettings; variables: TemplateVariable[]; elements: TemplateElement[];
};

type PageSettings = {
  size: "A4" | "A5" | "LETTER";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
};

type TemplateElement = {
  id: string; type: string;
  x: number; y: number; width: number; height: number;
  style: Record<string, unknown>;
  content?: string; dataBinding?: string; conditions?: string[];
  children?: TemplateElement[];
};
```

Implementation may extend these so long as the separation holds.

## 9. Seed content

Preloaded templates, each with a real thumbnail that opens in the editor: Invoice Modern,
Invoice Classic, Invoice Minimal, Invoice Corporate, Quotation Modern, Certificate Classic,
Payslip Modern, Audit Report.

## 10. Acceptance bar

Functional in the frontend: drag · resize · select · edit properties · edit text · bind
variables · change test data · update preview · undo/redo · duplicate · delete · reorder ·
switch templates · create versions · save locally.

The result should feel commercially viable and communicate:
*Start with a professional template. Customize everything. Connect your application data.
Change the design without changing application code.*

## 11. Open items

| # | Item | Status |
| --- | --- | --- |
| 1 | External UI mock covering **both** app chrome and report/document layouts | Pending from stakeholder — blocks all UI implementation |
| 2 | QR/barcode encoding fidelity in the prototype | Prototype renders a visual placeholder; real encoding is a server concern |
