# Templify

**A self-hosted report template platform.**

> Your application owns the data. Templify owns the document design.

A business application POSTs a `templateId` and a `data` payload. Templify renders the
document. The application never contains layout, styling, logo handling, table code or PDF
logic — so changing how an invoice looks stops being a code change, a build and a deploy,
and becomes: open the editor, save, done.

```
Traditional                          With Templify

Business App                         Business App
 ├── Data                             └── Data
 ├── PDF code                                │
 ├── Layout                                  ▼
 ├── Styling                          Templify
 ├── Logo                              ├── Template
 ├── Tables                            ├── Layout
 └── Report logic                      ├── Branding
                                       ├── Data Binding
Design change                          └── Rendering
      ↓
Developer → code → build → deploy    Design change
                                           ↓
                                     Open editor → Save → Done
```

---

## Status

Complete and verified. Built to a stakeholder-approved UI mock (kept out of version
control — it is a design source, not a build input).

| Area | State |
| --- | --- |
| Schema, binding engine, conditions, resolver, versioning, persistence, import/export | ✅ 56/56 runtime checks |
| Design system, shell, all eight screens, editor workspace, 26 built-in layouts | ✅ 40/40 render checks |
| Type check · production build | ✅ clean |

**Screens:** Dashboard · Templates · Template Library · Same Data Demo · API · Settings ·
Editor · Preview.

Planning documents live in [`docs/`](docs/):

- [`product-spec-templify.md`](docs/product-spec-templify.md) — requirements (serves as PRD)
- [`architecture-templify-2026-08-14.md`](docs/architecture-templify-2026-08-14.md) — architecture, decisions, trade-offs
- [`bmm-workflow-status.yaml`](docs/bmm-workflow-status.yaml) — BMAD workflow state

> **Naming.** The product is **Templify** throughout — the app, the Docker image
> (`templify/report-server`), the internal host (`http://templify:8080`), the API key prefix
> (`tf_live_`) and the `.templify` export format. The design mock carried an earlier working
> title; the visual design is the mock's, the name is not.

---

## Running it

### With Docker — the real thing

One image, one port, one volume. The editor UI and the render API are served together.

```bash
docker compose up -d
```

Or without compose:

```bash
docker run -d -p 8080:8080 -v templify:/data --shm-size=512m templify/report-server
```

Open <http://localhost:8080> for the editor, and POST to
`http://localhost:8080/api/reports/render` from your application. Templates persist to the
`/data` volume and are **shared by everyone using the instance** — which is what makes them
addressable by a `templateId` from your code.

`--shm-size` matters: Chromium crashes on larger documents with Docker's default 64 MB of
shared memory.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Listen port |
| `TEMPLIFY_DATA_DIR` | `/data` | Where templates persist — mount this |
| `TEMPLIFY_API_KEY` | *(unset)* | When set, `/api/*` requires `Authorization: Bearer <key>` |
| `TEMPLIFY_RENDER_TIMEOUT_MS` | `30000` | Ceiling on a single render |
| `TEMPLIFY_STATIC_DIR` | `/app/public` | Built frontend assets |

### Without Docker — frontend only

Requires **Node 20+** (developed against Node 24.19.0 LTS via [nvs](https://github.com/jasongin/nvs)).

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. **No backend is required.** The app probes its own origin
for a report server at boot; finding none, it falls back to `localStorage`. Everything works
except the parts that genuinely need a server: templates are per-browser rather than shared,
and there is no PDF rendering. The sidebar says which mode you are in rather than pretending.

To run the server locally without Docker:

```bash
npm run build:all && TEMPLIFY_DATA_DIR=./.data TEMPLIFY_STATIC_DIR=./dist npm start
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Types only |
| `npm run build:all` | Frontend + server bundle |
| `npm start` | Run the built server |
| `npm run verify` | Runtime checks over the domain layer (56) |
| `npm run verify:render` | Renders every screen and component (40) |

The two verify scripts are worth knowing about. `verify` loads the real modules through
Vite and asserts the behaviour the product depends on — binding resolution, repeater scope
chaining, condition evaluation, version pinning, and the guarantee that an export contains
no customer data. `verify:render` server-renders every screen to catch crashes, and checks
all 26 built-in templates actually resolve to bound content.

---

## Architecture

Four layers, strictly one-directional. **A layer may only import from layers below it.**

```
┌─────────────────────────────────────────────────────────────┐
│ UI          React — pages, editor panels, canvas chrome      │
├─────────────────────────────────────────────────────────────┤
│ STATE       Zustand — draft, catalogue, history, test data   │
├─────────────────────────────────────────────────────────────┤
│ DOMAIN      Pure TypeScript — binding, conditions, resolve,  │
│             versioning, export, persistence port             │
├─────────────────────────────────────────────────────────────┤
│ SCHEMA      Types only. Zero dependencies.                   │
└─────────────────────────────────────────────────────────────┘
```

**The schema and domain layers contain no React.** That is not a style preference — it is
what allows the identical modules to run inside the Node render server later. It is
enforceable by grep, and `npm run verify` executes those modules outside React to prove it.

```
server/          Report server — API, storage, PDF. Imports src/ unchanged.
src/
├── types/       Schema. The contract. No imports.
├── services/    Pure domain logic. No React, no DOM.
├── state/       Zustand stores, one per domain concern.
├── editor/      The editor workspace (canvas, panels, dialogs, registry).
├── components/  Reusable UI — ui/ primitives plus shared composites.
├── pages/       Route-level screens.
├── templates/   Built-in templates — data, not components.
├── data/        Sample payloads.
├── utils/       cn, id, format, geometry, page maths, download.
└── app/         Shell, routing, layout frame.
```

### One rendering pipeline, four consumers

This is the most important structural decision in the product.

```
     ReportTemplate                ReportData
   (design, versioned)      (test data / API payload)
            └──────────────┬──────────────┘
                           ▼
                 resolveDocument()        ← pure, React-free, Node-safe
               · resolve {{bindings}}
               · evaluate conditions
               · expand repeaters & rows
               · compute layout boxes
                           ▼
                   ResolvedDocument
                           │
   ┌───────────┬───────────┴───────────┬──────────────────┐
   ▼           ▼                       ▼                  ▼
 Canvas     Preview               Thumbnail        [Future] Server
(editable) (chrome-free)      (real, not a bitmap)   HTML → PDF
```

Because every surface consumes the same projection, thumbnails are genuinely rendered
templates rather than screenshots, and preview fidelity is a property of the architecture
instead of a promise maintained by hand.

---

## Template schema

A template is **inert, serialisable data** — never code. This is what makes versioning,
export, duplication and server-side rendering fall out almost for free.

```ts
interface ReportTemplate {
  id: string            // the public handle: what applications send as templateId
  name: string
  category: TemplateCategory
  description: string
  version: number
  builtIn: boolean      // built-ins are immutable; "use" duplicates them
  archived: boolean
  createdAt: string
  updatedAt: string

  page: PageSettings          // ┐
  branding: TemplateBranding  // ├ the versionable surface (TemplateSnapshot)
  variables: TemplateVariable[] // │
  elements: TemplateElement[] // ┘

  versions: TemplateVersion[] // each holds a full immutable snapshot
}

interface PageSettings {
  size: 'A4' | 'A5' | 'LETTER'
  orientation: 'portrait' | 'landscape'
  margins: { top: number; right: number; bottom: number; left: number }
  background: string
}

interface TemplateElement {
  id: string
  type: ElementType         // text | heading | table | logo | chart | qrCode | …
  x: number; y: number; width: number; height: number
  style: ElementStyle
  content?: string          // may embed {{bindings}}
  dataBinding?: string
  conditions?: string[]     // all must pass for the element to render
  children?: TemplateElement[]
  props?: ElementProps      // per-type config: table columns, logo source, chart …
}
```

Coordinates are CSS pixels at 96 dpi, so an A4 portrait page is 794 × 1123.

**There is no invoice-specific logic anywhere in the editor.** An invoice is data plus
elements expressed in this schema — which is why quotations, receipts, certificates,
payslips, purchase orders and audit reports need no editor changes at all.

### Data binding

Templates address application data with `{{path}}` tokens:

```
{{customer.name}}                 nested paths
{{items[0].price}}                array indexing
{{invoice.total | currency}}      optional formatter
{{item.name}}                     row scope, inside a table or repeater
```

Repeaters and table rows push an `item` scope over the payload, so array data is bound
through the UI rather than by hand-writing loops. Missing paths degrade gracefully: the
editor shows the token so the author can see the binding, print renders nothing, and the
resolver reports every unresolved path — the signal the server will use to return a precise
`422` instead of silently rendering blanks.

**Adding a field that does not exist yet.** Bindings are free text, so you can always just
type `{{invoice.poNumber}}`. To make it a first-class part of the template, use
**Insert Variable → New variable**: give it a path and a sample value, and Templify

1. writes the sample into the applied test data, so it renders immediately;
2. declares it in the template's `variables[]` — the data contract, which travels with a
   `.templify` export while the sample data does not; and
3. inserts the token at your cursor.

`items[].sku` sets the key on **every** array member and inserts the row-scoped form
`{{item.sku}}`, which is what a table column or repeater needs. A row-scoped token placed
outside a repeating context has no `item` to resolve against and will stay unresolved —
by design, and visible in the editor.

### Conditional display

```
invoice.discount > 0
customer.email exists
items empty
!invoice.paid
```

Operators: `> >= < <= == != contains exists empty`, plus `!` negation and bare-path
truthiness. Multiple conditions on an element are ANDed.

This is evaluated by a small hand-written parser — **never `eval` or `new Function`**.
A `.templify` file is untrusted input and must not be able to execute code, in the editor
or later on the server.

---

## How the editor works

Three panes: component library, canvas, properties. The canvas is a **white printable page
on dark chrome**, which is the visual thesis of the product — you are designing a document
inside a professional tool.

- **Drag from the palette** to place elements; **drag and resize on canvas** with snap-to-grid
  and live alignment guides.
- **Select** to reveal resize handles and a floating toolbar (duplicate, align, layer order,
  delete).
- **Properties** are grouped into Layout, Typography, Appearance, Data and Conditions.
- **Test Data** opens a JSON editor; pressing Apply updates the document immediately,
  because bindings resolve at render time and are never cached into element state.

**Undo/redo** is snapshot-based with explicit gesture boundaries: a drag that emits hundreds
of position updates collapses into exactly one undo step.

**The editor works on a draft copy**, never on the stored catalogue. Save promotes the draft
— which is what makes "unsaved changes" meaningful and keeps undo scoped to the session.

---

## How template IDs work

The `templateId` is the contract between the customer's application and Templify. It must
be unique, and uniqueness is checked against built-ins too, so a user template can never
shadow a catalogue entry and make a `templateId` ambiguous.

```
invoice-modern       → always the latest version
invoice-modern:v2    → pinned to version 2
```

**Pinning is what stops a designer's edit from breaking a live integration.** Versions store
full immutable snapshots rather than diffs, precisely so a pinned version can be
reconstructed in isolation — including in a different process, when the render server
resolves it.

Version history is **append-only**. Restoring an old version does not rewind the list; it
appends a new version carrying the old design. Nothing is ever destroyed, and a restore is
itself reversible.

### Built-in templates are never mutated

Built-ins are compiled into the bundle rather than stored, so there is no write path to
them at all. Choosing one duplicates it into a user-owned template at v1 with its own
lineage:

```
Built-in template → Use Template → enter name + ID → duplicate → editable user template
```

---

## Import / export

Templates export as `.templify` files carrying metadata, page settings, branding, variables,
elements, styles and data bindings.

> **An export never contains customer data.** The export service does not import the test
> data store and holds no reference to any payload, so a leak is structurally impossible
> rather than a rule someone has to remember. `npm run verify` asserts this.

Imports are treated as untrusted input: shape-validated, defaulted, and re-keyed on id
collision so an import can never overwrite an existing template.

> **Note:** the brief suggested a `.invoiceforge` extension, carried over from the earlier
> working name. Since the product is Templify — and is explicitly not invoice-specific —
> the extension is `.templify`. Say the word if you want it changed back.

---

## The report server

```js
const response = await fetch('http://templify:8080/api/reports/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ templateId: 'invoice-modern', data: invoiceData }),
})
// -> application/pdf
```

```
POST   /api/reports/render      Render a document from templateId + data
GET    /api/health              Status, version, PDF availability
GET    /api/templates           List templates
POST   /api/templates           Create (409 if the id is taken)
GET    /api/templates/:id       Fetch — accepts `id` or `id:vN`
PUT    /api/templates/:id       Update
DELETE /api/templates/:id       Delete
```

`options.format: "html"` returns the document as HTML instead of PDF — useful for debugging
a template without a PDF viewer in the loop.

**Unresolved bindings are always reported**, because that is the integrator's most likely
failure mode. Every render returns an `X-Templify-Missing-Bindings` header listing paths the
template referenced but the payload lacked. Send `options.strict: true` to turn that into a
`422` with the offending paths instead of a document with blank fields.

**How the frontend plugs in.** Every read and write goes through the `TemplateRepository`
port, and the app picks its implementation at boot by probing `/api/health`:

```ts
// src/services/repositoryFactory.ts
const response = await fetch(`${configured}/api/health`)
return response.ok
  ? new HttpTemplateRepository(configured)   // shared, API-addressable
  : new LocalStorageTemplateRepository(seed) // no backend, still works
```

Nothing above that line knows which it got — which is exactly what the port was for.

**The server imports `src/types` and `src/services` unchanged**, and renders documents
through the *same* `resolveDocument` and `ElementRenderer` the editor uses, via
`renderToStaticMarkup`. A PDF therefore cannot drift from the canvas, because no second
renderer exists to disagree. That reuse is the entire reason the no-React rule on those
layers was treated as non-negotiable.

Fonts are installed into the image rather than fetched, so output is identical on a host
with no internet access. Self-hosting is a product decision, not a deployment detail: report
payloads contain invoices, payslips and audit findings, and keeping rendering inside the
customer's network removes an entire class of data-residency objection.

---

## Known limitations

Recorded plainly rather than discovered later:

- **PDF download is not implemented.** No renderer exists yet, so the buttons will show a
  toast rather than emit a fake file.
- **QR codes and barcodes render a visual placeholder**, not a scannable encoding. A code
  that looks real but does not scan would be worse than an obvious placeholder; real
  encoding is a server concern.
- **No pagination.** Elements are absolutely positioned and do not reflow across pages, so
  content longer than one page will overflow. This is the largest genuine gap between the
  prototype and a shippable product.
- **`localStorage` is not durable.** It is browser-local, cleared by browsing-data wipes,
  and capped near 5 MB — which base64 logo uploads consume quickly. Export is the backup
  mechanism until the server exists.
- **No unit-test suite ships.** The pure domain layer is shaped to make tests cheap to add;
  the two verify scripts cover its core behaviour and guard against render crashes in the
  meantime. They are not a substitute for clicking through the app.
- **Nested elements are not individually selectable on canvas.** Selection targets
  top-level elements; grouping and ungrouping work, but drilling into a group does not.

---

## Tech stack

React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Radix UI · Zustand 5 · React Router 6 ·
dnd-kit · Lucide · CodeMirror 6

Two stack notes worth flagging, both argued in the architecture doc:

- **CodeMirror 6 instead of Monaco.** Monaco's default Vite integration loads its workers
  from a CDN, which breaks the "runs with no backend" requirement, and costs several
  megabytes for one JSON drawer.
- **dnd-kit for the palette, custom pointer handlers on canvas.** Canvas manipulation needs
  zoom-compensated deltas, snapping and live guides — constraints that fight a generic
  drag-and-drop abstraction.
