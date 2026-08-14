# System Architecture: Templify

**Date:** 2026-08-14
**Architect:** LakminaEgodawatthaBI
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3
**Status:** Draft

---

## Document Overview

This document defines the system architecture for Templify. It provides the technical
blueprint for implementation, addressing all functional and non-functional requirements
from the product specification.

**Related Documents:**
- Product Requirements Document: `docs/product-spec-templify.md`
- Product Brief: *skipped — superseded by the stakeholder-authored specification*

**Scope note.** The current deliverable is a **backend-free frontend prototype**. Sections
covering databases, authentication, high availability and disaster recovery therefore
describe the *forward-looking* self-hosted render server rather than shipping code. They
are marked **[Future]**. Inventing an HA plan for an application with no server would be
architecture theatre; the seams that make that server droppable-in are specified instead.

---

## Executive Summary

Templify inverts the usual ownership of report generation. Today a business application
carries its data *and* its PDF code, layout, styling, logo handling and table logic; a
design change costs a developer, a build and a deploy. Templify leaves the application
holding only data, and takes ownership of the document: template, layout, branding, data
binding and rendering. A design change becomes *open editor → save → done*.

Architecturally this reduces to one central idea:

> **A template is inert data, not code.** `ReportTemplate` is a plain, serialisable,
> React-free structure. The editor is one of several consumers that project it to pixels.

Three consequences follow, and they drive the whole design:

1. **One rendering pipeline, several consumers.** A single pure function turns
   *(template + data)* into a `ResolvedDocument`. The editing canvas, the clean preview,
   the library thumbnails and — later — the server's HTML/PDF output all consume that same
   projection. Thumbnails are genuinely rendered templates, not screenshots, and preview
   fidelity is structural rather than maintained by hand.
2. **The editor is document-type agnostic.** There is no invoice logic in the editor. An
   invoice is data plus elements expressed in the generic schema, which is why quotations,
   payslips, certificates and audit reports need no editor changes.
3. **Persistence is a port, not a decision.** Everything goes through a
   `TemplateRepository` interface, satisfied today by `localStorage` and tomorrow by the
   Docker server over HTTP — with no change above the seam.

The application is a modular monolith SPA in four layers (Schema → Domain → State → UI),
where the lower two layers contain no React and could be lifted into the Node render
server unchanged.

---

## Architectural Drivers

These requirements heavily influence architectural decisions. They are ranked by
architectural impact, not by user visibility.

| # | Driver | Architectural consequence |
| --- | --- | --- |
| **AD-1** | *The template schema must not depend on React* (PRD §7) | Hard dependency rule: `types/` and `services/` import nothing from `react`. Enforced by review and by the fact that the same modules must run in Node. |
| **AD-2** | *Canvas, preview and thumbnail must agree* | A single `resolveDocument()` projection with a render-mode flag, rather than three drawing code paths. |
| **AD-3** | *Applying test data must update the document immediately* (FR-9) | Bindings resolve **derived-on-render**. Resolved values are never written back into element state, so there is no cache to invalidate and no staleness path. |
| **AD-4** | *Undo/redo over position, size, style, content and binding* (§29) | Snapshot-based history over the versionable `TemplateSnapshot`, with explicit commit boundaries so a 200-event drag is one undo step. |
| **AD-5** | *Built-in templates must never be mutated* (FR-4) | Two separate registries: a frozen built-in catalogue compiled into the bundle, and a mutable user catalogue in storage. Use = copy. |
| **AD-6** | *`invoice-modern:v2` must keep working after a redesign* (FR-11) | Versions hold immutable full snapshots, not diffs. Resolution parses the `id:vN` handle. |
| **AD-7** | *Must run with no backend, and survive refresh* (§39) | Repository port with a `localStorage` adapter; all writes go through it. |
| **AD-8** | *Dark application, white document* (§3 "critical visual rule") | Two isolated style domains. Document styling is inline, computed from the schema — it must not inherit application tokens, or the printed output would drift from the screen. |
| **AD-9** | *Editor is desktop-first; management pages responsive* (§28) | Viewport gate on the editor route only. |
| **AD-10** | *Same editor must serve 10+ document types without rewrite* (§36) | Element **registry** pattern: adding a type is one entry, touching no editor internals. |
| **AD-11** | *Never export customer data with a template* (FR-13) | Export serialises the design surface only; test data lives in a separate store that the exporter cannot reach. |

**Deliberately absent drivers.** No authentication, multi-tenancy, throughput or
concurrency requirement exists for the prototype. Designing for them now would violate the
PRD's own instruction not to over-build, and would compromise AD-7.

---

## System Overview

### High-Level Architecture

Four layers, strictly one-directional: **Schema → Domain → State → UI**. A layer may only
import from layers above it in this list.

1. **Schema layer** (`src/types/`) — the serialisable contract. Pure TypeScript types.
   Zero runtime dependencies. This is what a `.templify` file contains and what the render
   server will accept.
2. **Domain layer** (`src/services/`, `src/utils/`) — pure functions over the schema:
   binding resolution, condition evaluation, document resolution, versioning, import/export,
   persistence adapters. **No React.** Runnable in Node.
3. **State layer** (`src/state/`) — Zustand stores holding the mutable session: the
   template catalogue, the editor working copy, history, test data, transient UI.
4. **UI layer** (`src/app/`, `src/pages/`, `src/components/`, `src/editor/`) — React.
   Reads state, dispatches intents, renders the projection. Holds no template logic.

**Interaction:**

```
User intent → State store action → Domain function (pure) → new schema snapshot
                                                                    │
                                                       resolveDocument(template, data)
                                                                    │
                                                            ResolvedDocument
                                                                    │
                                                          React renders projection
```

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  UI LAYER (React)                            │
│                                                                              │
│   pages/            editor/                     components/                  │
│   ├ Dashboard       ├ EditorWorkspace           ├ ui/  (dark design system)   │
│   ├ Templates       ├ canvas/    ┐              ├ TemplateCard               │
│   ├ Library         ├ panels/    ├─ all render  └ TemplateThumbnail          │
│   ├ Compare         └ dialogs/   ┘   via ↓                                   │
│   ├ Api                                                                      │
│   └ Settings                  ElementRenderer  ← the ONLY element→pixels map  │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ reads
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                              STATE LAYER (Zustand)                           │
│   templateStore   editorStore   historyStore   testDataStore   uiStore        │
│   (catalogue)     (draft+sel)   (undo/redo)    (payloads)      (toasts)       │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ calls
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                        DOMAIN LAYER (pure TS — no React)                      │
│   binding.ts      resolveDocument.ts   conditions.ts   versioning.ts          │
│   exportService   templateRepository (PORT)                                   │
│                            │                                                  │
│              ┌─────────────┴─────────────┐                                    │
│              ▼                           ▼                                    │
│   LocalStorageRepository        HttpRepository  [Future — Docker server]      │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ operates on
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                     SCHEMA LAYER (types only, serialisable)                   │
│   ReportTemplate · PageSettings · TemplateElement · ElementProps ·            │
│   TemplateVersion · TemplateSnapshot · ReportData                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**The rendering pipeline — one projection, four consumers:**

```
        ReportTemplate                    ReportData
     (design, versioned)          (test data / API payload)
              └───────────────┬───────────────┘
                              ▼
                    resolveDocument()          ← pure, React-free, Node-safe
                  · resolve {{bindings}}
                  · evaluate conditions
                  · expand repeaters & table rows
                  · compute layout boxes
                              ▼
                      ResolvedDocument
                              │
      ┌───────────┬───────────┴────────────┬──────────────────┐
      ▼           ▼                        ▼                  ▼
  Canvas       Preview                Thumbnail        [Future] Server
 (editable,   (chrome-free,          (scaled, real,      HTML → PDF
 selection,    print-accurate)        not a bitmap)      (Puppeteer)
 handles)
```

That fan-out is the single most important structural decision in the product: it is what
makes "what you see is what renders" a property of the architecture rather than a promise.

### Architectural Pattern

**Pattern:** Schema-driven modular monolith (client-side SPA), layered, with a persistence
port and an element registry.

**Rationale:**

- *Why a monolith, not services?* There is one deployable artifact (a static bundle) and
  one user. Service boundaries would add coordination cost and buy nothing. The PRD's
  Level 3 complexity is in the **editor's interaction surface**, not in distribution.
- *Why schema-driven?* It is the only pattern that satisfies AD-1, AD-2, AD-10 and AD-6
  simultaneously. Once templates are inert data, versioning becomes snapshotting,
  export becomes serialisation, thumbnails become rendering, and server-side rendering
  becomes running the same domain functions in Node.
- *Why a registry for elements?* The alternative — a `switch` over element type scattered
  across canvas, properties panel and renderer — is precisely what makes editors
  document-type-specific. Centralising type metadata means adding *Barcode* or
  *Signature* touches one file.
- *Why a persistence port?* It is the seam the entire Docker story hangs on. Without it,
  "swap localStorage for the server" is a refactor; with it, it is a constructor argument.

---

## Technology Stack

The stack was **fixed by the stakeholder brief (PRD §2)**. Choices are recorded with
rationale and trade-offs rather than re-litigated.

### Frontend

**Choice:** React 18 + TypeScript 5 + Vite 5

**Rationale:** Mandated. Independently sound: the editor is a highly interactive,
state-dense surface where React's reconciliation and the ecosystem's drag/overlay
primitives pay off. TypeScript is non-negotiable given that the template schema *is* the
product contract — the types are the specification. Vite gives sub-second HMR, which
matters when iterating on canvas interaction.

**Trade-offs:** ✓ Ecosystem, type safety, fast iteration. ✗ React's render model is a poor
fit for high-frequency pointer streams — mitigated by keeping drag/resize transforms in
refs and committing to store state only at gesture end (see NFR-010).

### Styling & Components

**Choice:** Tailwind CSS 3 + Radix UI primitives (shadcn/ui-equivalent, hand-assembled)

**Rationale:** Tailwind for the **application chrome**, where the PRD dictates an exact
palette that maps cleanly to design tokens. Radix for dialogs, dropdowns, tooltips,
popovers and tabs — accessible behaviour (focus trapping, keyboard nav, collision
handling) that is expensive to rebuild and easy to get subtly wrong.

**Critical constraint (AD-8):** Tailwind classes are used for chrome **only**. Document
elements are styled with **computed inline styles derived from the schema**, because the
document must render identically outside this application — in the preview, in a
thumbnail, and eventually in a headless browser that has never loaded our stylesheet. A
document that inherited app CSS would print differently than it looks.

**Trade-offs:** ✓ Velocity, consistency, accessibility. ✗ Two styling idioms in one
codebase — accepted deliberately, and the boundary is the point.

### State Management

**Choice:** Zustand 5, split into five domain stores

**Rationale:** Mandated, and correct for this shape. The editor needs frequent,
fine-grained updates from deep component trees; Zustand's selector subscriptions avoid the
re-render cascade a single Context would cause. Its store-as-plain-object model also keeps
stores callable from non-React code, which suits the layering rule.

**Trade-offs:** ✓ Minimal boilerplate, surgical subscriptions, no provider nesting.
✗ No built-in devtools time-travel — irrelevant, since history is explicit (AD-4).

### Interaction Libraries

**Choice:** dnd-kit for palette→canvas and list reordering; **custom pointer handlers**
for canvas move/resize.

**Rationale:** A split decision worth stating plainly. dnd-kit handles sensor abstraction,
accessibility and collision detection well for discrete drop targets. But canvas
manipulation needs sub-pixel control, live alignment guides, snap-to-grid and
zoom-compensated deltas — constraints that fight a generic DnD abstraction. Direct
pointer events are simpler *and* better here.

**Trade-offs:** ✓ Right tool per job. ✗ Two interaction models to understand.

### Code Editing

**Choice:** CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-json`)

**Rationale:** The PRD suggests Monaco "if practical". It is not the better choice here:
Monaco's default Vite integration resolves its workers from a CDN, which breaks the
"works with no backend / offline" requirement, and it adds several megabytes for what is
one JSON drawer. CodeMirror 6 bundles cleanly, is roughly an order of magnitude smaller,
and provides the needed syntax highlighting, folding, gutter and **JSON lint** — the last
being what actually matters, since invalid test data must be caught before Apply.

**Trade-offs:** ✓ Offline-safe, small, lintable. ✗ Less familiar API than Monaco.

### Backend

**[Future]** None in this deliverable. The prototype is deliberately serverless — the PRD
requires it to run with `npm install && npm run dev` and no backend.

The planned self-hosted server is a **Node service in a Docker container** that imports
the *same* `src/types` and `src/services` modules (this is what AD-1 buys) and renders via
headless Chromium (Puppeteer) to PDF. It exposes the API in *API Design* below. The
frontend is already shaped for it: the `TemplateRepository` port is the only thing that
changes.

### Database

**[Future]** Prototype uses `localStorage` under versioned keys (`templify.v1.*`) behind
the repository port. The server will need durable storage for templates and versions;
given the access pattern (read-mostly, keyed by `templateId`, whole-document reads,
immutable version snapshots), a document store or even a mounted volume of JSON files is
sufficient. **No relational modelling is warranted** — a template is a single aggregate
that is always read and written whole.

### Infrastructure

**[Future]** Single Docker image, self-hosted by the customer, on their network:

```bash
docker run -d -p 8080:8080 templify/report-server
```

Self-hosting is a product decision, not an afterthought: report payloads contain customer
invoices, payslips and audit findings. Keeping rendering inside the customer's perimeter
removes an entire class of data-residency objection.

### Third-Party Services

**None.** No auth provider, no payment provider, no email, no analytics, no monitoring —
four of these are explicitly forbidden by the PRD. Fonts are loaded from Google Fonts for
the chrome; the document uses web-safe families so that server-side rendering is not
network-dependent.

### Development & Deployment

- **Runtime:** Node 24.19.0 LTS via **nvs** (stakeholder's toolchain).
- **Build:** `tsc -b && vite build` → static assets.
- **Version control:** Git.
- **CI/CD:** **[Future]** — not configured for the prototype; see *CI/CD Pipeline*.

---

## System Components

### C-1 · Template Schema (`src/types/`)

**Purpose:** The serialisable contract for a document design.

**Responsibilities:** Define `ReportTemplate`, `TemplateSnapshot`, `PageSettings`,
`TemplateElement`, per-type `ElementProps`, `TemplateVersion`, `ReportData`,
`TemplateExportFile`.

**Interfaces:** Type-only. Consumed by every other component.

**Dependencies:** None. *This is the invariant.*

**FRs addressed:** Underpins all. Directly PRD §8, §12.

---

### C-2 · Binding Engine (`src/services/binding.ts`)

**Purpose:** Resolve `{{path}}` tokens against a data scope.

**Responsibilities:**
- Path resolution with array indexing (`items[0].name`), tolerant of missing keys.
- Interpolation of mixed literal/token strings, with optional formatter
  (`{{invoice.total | currency}}`).
- **Scope chaining:** repeater and table rows push an `item` / `index` scope over root
  data, which is how `{{item.name}}` works without the user writing a loop (FR-8).
- Derive the `VariableNode` tree that powers *Insert Variable* (FR-7).

**Interfaces:** `resolvePath`, `interpolate`, `extractBindings`, `buildVariableTree`.

**Dependencies:** C-1, `utils/format`.

**FRs addressed:** FR-7, FR-8, FR-9.

---

### C-3 · Condition Evaluator (`src/services/conditions.ts`)

**Purpose:** Decide whether an element renders (`invoice.discount > 0`).

**Responsibilities:** Parse and evaluate a deliberately tiny expression grammar —
`<path> <op> <literal>`, bare-path truthiness, negation — with operators
`> >= < <= == != contains exists empty`. Multiple conditions on an element are ANDed.

**Design decision:** implemented as a hand-written mini-evaluator, **never `eval` or
`new Function`**. Template files are importable artifacts that may come from elsewhere; a
`.templify` file must not be able to execute code in the editor. This also keeps the
evaluator portable to the server, where the same rule matters more.

**Dependencies:** C-2.

**FRs addressed:** FR-6 (Conditional Display).

---

### C-4 · Document Resolver (`src/services/resolveDocument.ts`)

**Purpose:** The pipeline hub — *(template, data) → ResolvedDocument*.

**Responsibilities:** Walk the element tree; drop elements failing conditions; expand
repeaters and table rows into concrete nodes; interpolate content; compute absolute boxes;
carry a render mode (`edit` | `print`) so the canvas can show binding chrome that print
must not.

**Interfaces:** `resolveDocument(template, data, mode): ResolvedDocument`

**Dependencies:** C-1, C-2, C-3.

**FRs addressed:** FR-6, FR-8, FR-9, FR-10, FR-12 — and the thumbnail requirement in FR-3.

---

### C-5 · Element Registry (`src/editor/registry/`)

**Purpose:** Single source of truth for what an element *is*.

**Responsibilities:** Per `ElementType`: label, icon, palette category, default size,
factory for default props, which property sections apply, and the render function.

**Why it exists:** This is the component that makes AD-10 true. Adding *Barcode* is one
registry entry; the palette, canvas, properties panel and renderer all pick it up without
modification.

**Dependencies:** C-1, C-4.

**FRs addressed:** FR-6 (component library), §36 extensibility.

---

### C-6 · Template Repository (`src/services/templateRepository.ts`)

**Purpose:** Persistence **port** — the seam to the future server.

**Responsibilities:** `list`, `get(idOrHandle)`, `create`, `update`, `remove`, plus
version operations. Resolves pinned handles (`invoice-modern:v2`).

**Adapters:** `LocalStorageTemplateRepository` (now) · `HttpTemplateRepository`
**[Future]**, same interface, talking to the Docker server.

**Dependencies:** C-1.

**FRs addressed:** FR-3, FR-11, §39 persistence.

---

### C-7 · Versioning Service (`src/services/versioning.ts`)

**Purpose:** Immutable design history.

**Responsibilities:** Snapshot the versionable surface; create, list, restore; maintain
the current-version pointer; parse `id:vN` handles.

**Design decision:** **full snapshots, not diffs.** A version must be reconstructible in
isolation and in a different process (the server) with no replay logic. Templates are
kilobytes; storage is not the constraint, and correctness under AD-6 is.

**FRs addressed:** FR-11, FR-12.

---

### C-8 · Import / Export (`src/services/exportService.ts`)

**Purpose:** `.templify` file round-trip.

**Responsibilities:** Serialise metadata, page settings, branding, variables, elements,
styles and bindings; validate and re-key on import (assigning a fresh unique template ID
on collision).

**Safety invariant (AD-11):** the exporter takes a `ReportTemplate` and has **no reference
to `testDataStore`**. Customer data cannot leak into an export because the function cannot
see it — enforced structurally, not by discipline.

**FRs addressed:** FR-13.

---

### C-9 · State Stores (`src/state/`)

| Store | Holds | Notes |
| --- | --- | --- |
| `templateStore` | User catalogue, CRUD, versions | Writes through C-6 |
| `editorStore` | Working draft, selection, canvas view (zoom/grid/snap/rulers) | Draft is a copy; Save promotes it |
| `historyStore` | `past[] / future[]` of `TemplateSnapshot` | Explicit commit boundaries |
| `testDataStore` | Per-template JSON payloads | Isolated from export |
| `uiStore` | Toasts, dialog open-state | Transient only |

**Design decision — editing a draft, not the catalogue.** The editor mutates an in-memory
working copy; the catalogue is only touched on Save. This gives Preview something coherent
to show, makes "unsaved changes" meaningful, and keeps undo scoped to a session.

**FRs addressed:** §29, FR-17.

---

### C-10 · Renderer (`src/editor/canvas/ElementRenderer.tsx`)

**Purpose:** The *only* place a resolved node becomes DOM.

**Responsibilities:** Render each element type from the registry using computed inline
styles; honour render mode; remain ignorant of selection and editing (that chrome is
overlaid by the canvas, not baked in).

**Why it is one component:** three renderers would drift, and preview fidelity would decay
silently. Canvas, preview and thumbnail differ only in scale, mode and surrounding chrome.

**FRs addressed:** FR-3, FR-6, FR-10, FR-12.

---

## Data Architecture

### Data Model

Templify has two distinct data worlds, and keeping them apart is a core safety property.

**World A — Design data (owned by Templify, persisted, exportable):**

```
ReportTemplate  (aggregate root; addressed by templateId)
├── id, name, category, description, version, builtIn, archived, timestamps
├── page:      PageSettings { size, orientation, margins, background }
├── branding:  TemplateBranding { primary, secondary, defaultLogo, defaultFooter, font }
├── variables: TemplateVariable[]        (declared data contract)
├── elements:  TemplateElement[]         (recursive tree; children for layout types)
│   └── TemplateElement
│       ├── id, type, name, x, y, width, height, locked, hidden
│       ├── style:       ElementStyle
│       ├── content?:    string          (may embed {{bindings}})
│       ├── dataBinding?: string
│       ├── conditions?: string[]
│       ├── props?:      ElementProps    (per-type config: table, logo, chart, …)
│       └── children?:   TemplateElement[]
└── versions:  TemplateVersion[]         (each holds a full immutable TemplateSnapshot)
```

**World B — Report data (owned by the customer application, never persisted by Templify):**

```
ReportData = arbitrary JSON   →   { company, customer, invoice, items[] }
```

**Cardinality:** Template `1..*` Versions. Element `0..*` Children (tree). Template has
**no** relationship to report data — the coupling is by `{{path}}` convention alone, which
is exactly why one payload can drive many designs (FR-12).

### Database Design

**[Prototype]** `localStorage`, namespaced and schema-versioned so a future format change
can migrate rather than corrupt:

| Key | Contents |
| --- | --- |
| `templify.v1.templates` | User template catalogue (with versions) |
| `templify.v1.testdata` | Per-template test payloads |
| `templify.v1.ui` | Editor preferences (zoom, grid, snap) |

Built-in templates are **not** stored — they are compiled into the bundle and treated as
read-only seed, which is what guarantees AD-5.

**[Future]** Document storage on the server. No normalisation: the template aggregate is
always read and written whole, and version snapshots are immutable blobs.

### Data Flow

**Editing (write path):**
```
Pointer/property intent → editorStore action → pure domain fn → new snapshot
   → historyStore.commit(previous)  → draft updated → subscribed components re-render
```

**Rendering (read path — no cache, by design AD-3):**
```
draft template + applied test data → resolveDocument() → ResolvedDocument → React
```

**Saving:**
```
editorStore.draft → templateStore.save → C-7 snapshot → C-6 repository → localStorage
```

**[Future] Server render:**
```
App POSTs { templateId, data } → server loads template via C-6 (Http/DB adapter)
   → resolveDocument() (same module) → HTML → Puppeteer → PDF → response
```

---

## API Design

### API Architecture

**Style:** REST over JSON. **[Future]** — documented and demonstrated by the prototype's
API page (FR-14), implemented by the render server.

**Versioning:** Two independent axes, deliberately not conflated —
- *Template* versioning via the handle: `invoice-modern` (latest) or `invoice-modern:v2` (pinned).
- *API* versioning via path prefix if it ever becomes necessary.

Template pinning is the one that protects customers: a designer's edit cannot break a live
integration (AD-6).

### Endpoints

```
POST   /api/reports/render      Render a document from templateId + data   ← the core endpoint

GET    /api/templates           List templates
POST   /api/templates           Create a template
GET    /api/templates/:id       Fetch one (accepts :id or id:vN)
PUT    /api/templates/:id       Update
DELETE /api/templates/:id       Delete
```

**Core request:**

```json
{ "templateId": "invoice-modern", "data": { "company": {}, "customer": {}, "invoice": {}, "items": [] } }
```

**Response:** `application/pdf` (or `text/html` when `options.format = "html"`).

**Error contract [Future]:** `404` unknown `templateId`; `422` template references a
binding absent from `data`, with the offending paths named — the failure mode most likely
to bite an integrator, so it must be explicit rather than silently rendering blanks.

### Authentication & Authorization

**[Future].** Deliberately none in the prototype, and *not* an oversight: Templify is
self-hosted inside the customer's own network, so the trust boundary is the network
perimeter. When added, the appropriate mechanism is a **static API key or mTLS between the
customer's application and the container** — not user-level OAuth, because the client is a
server process, not a person. Building user auth now would add a login wall to a
single-tenant design tool and satisfy no requirement.

---

## Non-Functional Requirements Coverage

### NFR-001: Schema / React independence

**Requirement:** The template schema must not depend on React; the editor operates on the
schema (PRD §7, §36).

**Architecture Solution:** `src/types/` is type-only with zero imports. `src/services/`
imports only from `types` and `utils`. The dependency direction is one-way and the payoff
is concrete: these modules run unchanged inside the Node render server.

**Validation:** No `react` import may appear under `src/types/` or `src/services/`;
grep-checkable and a review gate.

---

### NFR-002: Render fidelity across canvas, preview and thumbnail

**Requirement:** Thumbnails must be real previews (FR-3); preview must show the actual
report (FR-10).

**Architecture Solution:** One `resolveDocument()` projection and one `ElementRenderer`,
parameterised by scale and render mode. Divergence is structurally impossible because
there is no second code path to diverge into.

**Validation:** Same template at three scales must be visually identical modulo scale.

---

### NFR-003: Immediate data propagation

**Requirement:** Applying test data updates the document immediately (FR-9).

**Architecture Solution:** Bindings resolve during render from current store state.
Resolved values are never persisted into elements, so no invalidation exists to get wrong.

**Validation:** Change `customer.name`, press Apply, invoice text changes with no reload.

---

### NFR-004: Undo/redo integrity

**Requirement:** Position, size, style, content and binding changes are undoable (§29).

**Architecture Solution:** Snapshot history over `TemplateSnapshot` with explicit commit
boundaries — commit on gesture *end*, on structural operation, and debounced for
continuous inputs. A drag is one undo step, not two hundred.

**Validation:** Drag, resize, restyle, rebind — each is exactly one Ctrl+Z.

---

### NFR-005: Built-in template immutability

**Requirement:** Built-ins are never modified; use = duplicate (FR-4, §31).

**Architecture Solution:** Built-ins live in the bundle, not in storage; the catalogue is a
separate mutable collection. The editor route refuses a `builtIn` template and routes
through the duplicate dialog instead.

**Validation:** No path exists that writes a `builtIn: true` record to storage.

---

### NFR-006: Integration stability under redesign

**Requirement:** `invoice-modern:v2` keeps working after the design changes (FR-11).

**Architecture Solution:** Immutable full snapshots per version; handle parsing in the
repository. Editing produces a new version; it cannot retroactively alter an old one.

**Validation:** Pin v2, edit and save v3, resolve `:v2` — output unchanged.

---

### NFR-007: Backend-free operation and persistence

**Requirement:** Runs with `npm install && npm run dev`, no backend; refresh keeps changes (§39).

**Architecture Solution:** Repository port with a `localStorage` adapter; no network calls
anywhere in the prototype; assets bundled (no CDN-dependent editor).

**Validation:** Load with DevTools offline after first load; create, edit, refresh, verify.

---

### NFR-008: Style domain isolation

**Requirement:** Dark application, white printable document (§3, §32).

**Architecture Solution:** Chrome uses Tailwind tokens; document elements use computed
inline styles from the schema and inherit nothing from application CSS. The document is
therefore portable to a context that never loaded our stylesheet — which is precisely the
server's situation.

**Validation:** Rendering the document subtree in isolation produces identical output.

---

### NFR-009: Desktop-first editor, responsive management pages

**Requirement:** §28.

**Architecture Solution:** A viewport gate on the editor route only, showing the specified
guidance message below the threshold. Dashboard, Templates, Library, API and Settings use
responsive layouts.

**Validation:** Narrow viewport → editor gated, other routes usable.

---

### NFR-010: Editor interaction performance

**Requirement:** Implied by "feel extremely polished" (§33) — drag and resize must not stutter.

**Architecture Solution:** Pointer deltas applied to a transform held in a ref during the
gesture; store commit only on release. Zustand selector subscriptions keep re-renders
scoped to the affected element rather than the whole canvas. Repeaters carry a
`previewLimit` so a 500-row array cannot lock the editor.

**Validation:** Drag on a 40-element template stays smooth; only the dragged element and
its property fields re-render.

---

### NFR-011: Extensibility to further document types

**Requirement:** Quotation, Receipt, Certificate, Payslip, Audit Report, Financial Report,
Purchase Order, Delivery Note, Custom Report without rewriting the editor (§36).

**Architecture Solution:** Generic schema plus element registry; **zero invoice-specific
code in the editor**. An invoice is seed data.

**Validation:** Adding a document type requires no file under `src/editor/` to change.

---

### NFR-012: Export data safety

**Requirement:** Never export production/customer data with a template (FR-13).

**Architecture Solution:** Test data lives in a store the export service does not import.
The export type omits data by construction.

**Validation:** Inspect a `.templify` file — design surface only.

---

## Security Architecture

Scoped honestly to a client-side prototype with no accounts, no server and no
customer data at rest.

### Authentication

**None** — no accounts exist. **[Future]** service-to-service credential between the
customer application and the container (see *API Design*).

### Authorization

**None** — single-user tool. The only enforced access rule is domain-level: built-in
templates are read-only (NFR-005).

### Data Encryption

**At rest:** not applicable — `localStorage` holds template *designs*, not customer
records, and test data is developer-supplied sample JSON.
**In transit:** no network traffic. **[Future]** TLS to the container; note that
self-hosting means report payloads never leave the customer's network at all, which is a
stronger privacy position than any encryption choice.

### Security Best Practices

Applicable to this codebase, and each addresses a real vector:

- **No dynamic code execution.** Conditions use a hand-written evaluator; `eval` and
  `new Function` are prohibited. A `.templify` file is untrusted input and must never be
  able to execute.
- **Import validation.** Imported files are shape-validated before entering state.
- **No `dangerouslySetInnerHTML`** for user or data-derived content. Rich text renders
  through a constrained formatting model, not raw HTML injection.
- **Uploads stay local.** Logo uploads become data URLs in the template; nothing is
  transmitted.
- **Bounded input.** Repeater/table expansion is capped in the editor to prevent a
  malformed payload from hanging the tab.
- **[Future] Server-side:** the render container must treat template HTML as untrusted,
  run Chromium sandboxed with no host network access, and enforce a render timeout —
  because rendering customer-authored templates is the server's main risk surface.

---

## Scalability & Performance

### Scaling Strategy

**[Prototype]** Not applicable — a static bundle on one machine. The meaningful scale
dimension is *document complexity*, not users: the editor must stay responsive at ~100
elements and with arrays of several hundred rows.

**[Future]** The render server is stateless and CPU-bound (headless Chromium), so it scales
horizontally behind a load balancer. The real constraint is browser instances per
container, not request routing; a pooled browser with bounded concurrency is the expected
design.

### Performance Optimization

- Gesture transforms in refs; store commits at gesture end (NFR-010).
- Selector-scoped subscriptions to avoid canvas-wide re-render.
- Memoised `resolveDocument()` per (template revision, data revision) pair — recomputed
  when either changes, which preserves AD-3 while avoiding needless work.
- Thumbnails render a scaled projection rather than a full interactive canvas.
- Repeater `previewLimit` bounds editor-time expansion.

### Caching Strategy

Minimal and deliberate. The only cache is the memoised document resolution described
above, keyed on inputs so it cannot go stale. **No caching of resolved values inside
element state** — that would reintroduce exactly the invalidation bug AD-3 exists to
prevent.

### Load Balancing

**[Future]** Standard L7 balancer in front of stateless render containers. Not applicable
to the prototype.

---

## Reliability & Availability

### High Availability Design

**[Future].** Not applicable to a client-side prototype. The render server is stateless
and therefore trivially replicable; template storage is the only stateful component.

### Disaster Recovery

**[Prototype]** The user-facing recovery mechanisms are **template export** (`.templify`)
and **version history** — a bad edit is recoverable by restoring a version, which is a real
DR story at this scale. `localStorage` is browser-local and should not be treated as
durable; this is a known limitation, recorded in *Open Issues*.

**[Future]** RPO/RTO to be set with the storage decision.

### Backup Strategy

**[Prototype]** Manual, via export. **[Future]** Server-side snapshotting of the template
store.

### Monitoring & Alerting

**Explicitly out of scope** — the PRD forbids monitoring features. No telemetry is
collected.

---

## Integration Architecture

### External Integrations

**None in the prototype.** The product's entire integration surface is the future
`POST /api/reports/render` call made *by* the customer's application *to* Templify.
Templify calls nothing outbound — an important property, since it is deployed inside
customer networks.

### Internal Integrations

Layer-to-layer only, one-directional: UI → State → Domain → Schema. Enforced by review.

### Message/Event Architecture

Not applicable. Rendering is synchronous request/response. **[Future]** if large batch
rendering is needed, a job queue with polling would be the natural extension — but nothing
in the current requirements calls for it.

---

## Development Architecture

### Code Organization

```
src/
├── app/          Shell, routing, layout frame
├── components/   Reusable UI — ui/ primitives + shared composites
├── editor/       The editor workspace: canvas/, panels/, dialogs/, registry/, hooks/
├── templates/    Built-in template definitions (data, not components)
├── state/        Zustand stores, one per domain
├── services/     Pure domain logic — binding, conditions, resolve, versioning, export, repository
├── types/        Schema. No dependencies.
├── pages/        Route-level screens
├── data/         Sample payloads and seed content
└── utils/        cn, id, format, geometry, page maths
```

### Module Structure

Binding rules, taken directly from PRD §36:

1. No giant `App.tsx`; no single-file editor.
2. One clear responsibility per module.
3. No duplicated components — the strongest instance being *one* `ElementRenderer*.
4. No files created merely to split code.
5. `types/` and `services/` never import React.
6. `templates/` contains **data**, not components — a built-in template is a
   `ReportTemplate` literal, which is what allows it to be duplicated, versioned,
   exported and server-rendered like any user template.

### Testing Strategy

**Honest position:** the PRD specifies no testing requirement and the deliverable is a
prototype, so no test suite ships with it. Recording where tests *would* go, since the
layering makes it cheap later:

- The domain layer is pure and is the high-value target: binding resolution, condition
  evaluation, version restore, import validation — all testable without a DOM.
- Canvas interaction (drag/snap/guides) would need component-level tests.
- The `{{binding}}` grammar and the condition evaluator are the two places where a silent
  regression would be most damaging, and would be tested first.

**Type checking** via `tsc -b` under `strict` is the automated gate that does ship.

### CI/CD Pipeline

**[Future]** Not configured. The natural minimum is `npm ci → tsc -b → vite build` on push.

---

## Deployment Architecture

### Environments

**[Prototype]** Local development only (`npm run dev`, Vite on :5173).

### Deployment Strategy

**[Prototype]** `vite build` produces static assets deployable to any static host.
**[Future]** The render server ships as a Docker image the customer runs themselves.

### Infrastructure as Code

**[Future]** A `Dockerfile` and a `docker-compose.yml` for the server. The Settings page
represents this in UI only — the PRD explicitly forbids controlling Docker from the
frontend, and the frontend has no business holding daemon credentials.

---

## Requirements Traceability

### Functional Requirements Coverage

| FR | Name | Components | Notes |
| --- | --- | --- | --- |
| FR-1 | Application shell | `app/` | Sidebar + routes; editor is its own workspace |
| FR-2 | Dashboard | `pages/DashboardPage` | Deprioritised per §38 |
| FR-3 | Template management | `pages/TemplatesPage`, C-6, C-10 | Thumbnails are real renders |
| FR-4 | Template Library | `pages/TemplateLibraryPage`, `templates/builtin`, C-7 | Copy-on-use (NFR-005) |
| FR-5 | Create template | `components/CreateTemplateDialog`, C-6 | Uniqueness validated against catalogue |
| FR-6 | Template Editor | `editor/**`, C-5, C-9, C-10 | The priority-1 surface |
| FR-7 | Data binding | C-2, `panels/VariablePicker` | Tree derived from applied data |
| FR-8 | Repeating data / tables | C-2, C-4, `panels/TableSection` | Scope chaining; no user-written loops |
| FR-9 | Test data | `dialogs/TestDataPanel`, `testDataStore` | CodeMirror + JSON lint |
| FR-10 | Preview | `pages/PreviewPage`, C-4, C-10 | Toast only; no faked PDF |
| FR-11 | Versioning | C-7, C-6 | Immutable snapshots; `id:vN` |
| FR-12 | Same Data, Different Design | `pages/ComparePage`, C-4 | The product thesis, demonstrated |
| FR-13 | Import / export | C-8 | Data-leak-proof by construction |
| FR-14 | API page | `pages/ApiPage` | Documents the future server |
| FR-15 | Docker / self-hosted | `pages/SettingsPage` | UI representation only |
| FR-16 | Template settings | `dialogs/TemplateSettingsDialog` | Page + branding |
| FR-17 | Keyboard shortcuts | `editor/hooks/useKeyboardShortcuts` | Hints in tooltips |
| FR-18 | Empty states, toasts | `components/EmptyState`, `uiStore` | |

### Non-Functional Requirements Coverage

| NFR | Name | Solution | Validation |
| --- | --- | --- | --- |
| NFR-001 | Schema/React independence | One-way layering; type-only schema | No `react` import in `types/`, `services/` |
| NFR-002 | Render fidelity | Single projection + single renderer | Three scales, identical output |
| NFR-003 | Immediate data propagation | Derive-on-render, no write-back | Apply → visible change |
| NFR-004 | Undo/redo integrity | Snapshot history, commit boundaries | One gesture = one undo |
| NFR-005 | Built-in immutability | Separate registries; copy-on-use | No write path for built-ins |
| NFR-006 | Integration stability | Immutable version snapshots | `:v2` stable across v3 save |
| NFR-007 | Backend-free + persistent | Repository port, localStorage adapter | Offline reload retains state |
| NFR-008 | Style domain isolation | Inline computed document styles | Document renders standalone |
| NFR-009 | Desktop-first editor | Route-level viewport gate | Narrow viewport behaviour |
| NFR-010 | Interaction performance | Ref transforms, scoped subscriptions | Smooth drag at ~40 elements |
| NFR-011 | Extensibility | Generic schema + element registry | New type touches no editor file |
| NFR-012 | Export data safety | Exporter cannot reach test data | Inspect `.templify` |

---

## Trade-offs & Decision Log

**D-1 · Snapshot history rather than command/diff history**
✓ Gain: trivial correctness, restore-anywhere, versions and undo share one mechanism.
✗ Lose: memory grows with history depth; no semantic "what changed".
*Rationale:* templates are kilobytes. Bounding the stack costs one constant; getting
inverse-command pairs right for every operation costs ongoing bugs.

**D-2 · Full version snapshots rather than diffs**
✓ Gain: a version is independently reconstructible, including on the server.
✗ Lose: storage duplication.
*Rationale:* AD-6 is a customer-facing promise. Replay logic is the wrong place to be
clever.

**D-3 · CodeMirror 6 rather than the suggested Monaco**
✓ Gain: offline-safe bundling, ~10× smaller, JSON linting.
✗ Lose: deviates from the brief's suggestion; less familiar API.
*Rationale:* Monaco's CDN-based worker loading conflicts with the hard "no backend,
works offline" requirement. The brief said "if practical" — it is not.

**D-4 · Custom pointer handling for canvas, dnd-kit only for palette**
✓ Gain: sub-pixel control, zoom-compensated deltas, live guides.
✗ Lose: two interaction models in one codebase.
*Rationale:* generic DnD abstractions fight canvas requirements. Using the mandated
library where it is genuinely better, not everywhere.

**D-5 · Inline computed styles for the document, Tailwind for chrome**
✓ Gain: document is portable and print-accurate; server rendering needs no stylesheet.
✗ Lose: two styling idioms.
*Rationale:* the split *is* the critical visual rule (§3) expressed in code.

**D-6 · Editing a draft copy rather than the live catalogue**
✓ Gain: meaningful unsaved state, session-scoped undo, coherent preview.
✗ Lose: a synchronisation point at Save.
*Rationale:* matches how designers expect a document editor to behave.

**D-7 · No test suite in this deliverable**
✓ Gain: all effort goes to the priority-1 editor surface.
✗ Lose: regressions are caught by hand.
*Rationale:* stated plainly rather than hidden — the PRD requests a prototype and
specifies no testing NFR. The pure domain layer is deliberately shaped to make tests cheap
to add when it becomes a product.

**D-8 · No authentication**
✓ Gain: zero friction; honest to a single-tenant self-hosted tool.
✗ Lose: nothing today; a real gap once multi-user editing is wanted.
*Rationale:* the trust boundary is the customer's network perimeter.

---

## Open Issues & Risks

| # | Issue | Impact | Mitigation |
| --- | --- | --- | --- |
| **R-1** | **UI mock pending** for both app chrome *and* document layouts | Blocks all UI implementation | Foundation (schema, domain, state) is design-independent and proceeds now; UI layer built on arrival |
| **R-2** | `localStorage` is not durable — cleared by browsing-data wipes, per-origin quota (~5 MB), and logo data URLs consume it fast | Template loss | Export as user-facing backup; server storage resolves it. Quota pressure is real and should be watched |
| **R-3** | QR/barcode cannot be genuinely encoded client-side without a codec | A scannable-looking but non-scannable code would mislead | Render a clearly-labelled visual placeholder; real encoding is a server concern. **Do not fake it** |
| **R-4** | No PDF renderer exists yet | Download buttons cannot deliver | Toast per FR-10; never emit a fake file |
| **R-5** | Condition grammar is intentionally minimal | Users may want `AND`/`OR`/nesting | Multiple conditions AND implicitly; revisit only on real demand |
| **R-6** | Absolute-positioned elements do not reflow across pages | Content longer than one page (large tables) will overflow | Known prototype limitation; pagination is a server-render concern and a genuine future work item |

---

## Assumptions & Constraints

**Assumptions**
1. Single user, single browser, no collaboration or concurrent editing.
2. Test data is developer-supplied sample JSON, not production customer records.
3. Documents are page-oriented and predominantly single-page in the prototype (see R-6).
4. Modern evergreen browser with `crypto.getRandomValues` and `localStorage`.

**Constraints**
1. Stack fixed by the brief (React, TypeScript, Vite, Tailwind, Zustand, React Router,
   dnd-kit, Lucide).
2. Must run with `npm install && npm run dev` and **no backend**.
3. Four feature areas explicitly forbidden: email, monitoring, payments, CRM.
4. Dark chrome / white document is non-negotiable.
5. Built-in templates are immutable.
6. Toolchain: Node 24.19.0 LTS via nvs.

---

## Future Considerations

1. **The render server** — Node + Puppeteer in Docker, importing `types/` and `services/`
   unchanged. This is the payoff for NFR-001, and the reason it is treated as
   non-negotiable rather than stylistic.
2. **Pagination and multi-page flow** (R-6) — the largest genuine gap between the prototype
   and a shippable product.
3. **Real QR/barcode encoding**, server-side.
4. **Template variable contracts** — `variables[]` is declared but not yet enforced;
   validating an incoming payload against it would let the API return a precise `422`
   instead of rendering blanks, which is the integrator's most likely failure mode.
5. **Collaboration** — would require replacing snapshot history with CRDT or OT. A
   deliberate non-goal now; noted because D-1 is the decision that would need revisiting.
6. **Template marketplace** — the `.templify` format and copy-on-use semantics already
   support it.

---

## Approval & Sign-off

**Review Status:**
- [ ] Technical Lead
- [ ] Product Owner
- [ ] Security Architect *(limited scope — no auth, no server, no customer data at rest)*
- [ ] DevOps Lead *(not applicable to this deliverable)*

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-14 | LakminaEgodawatthaBI | Initial architecture |

---

## Next Steps

Implementation proceeds in two tracks, split by the R-1 blocker:

**Track A — unblocked, in progress now:** schema, binding engine, condition evaluator,
document resolver, state stores with undo/redo, repository + localStorage adapter,
versioning, import/export.

**Track B — blocked on the UI mock:** design system, application shell, all pages, editor
panels, canvas chrome, and the built-in template layouts.

Run `/sprint-planning` to break these into stories once the mock lands and Track B can be
estimated.

---

**This document was created using BMAD Method v6 - Phase 3 (Solutioning)**

*To continue: Run `/workflow-status` to see your progress and next recommended workflow.*

---

## Appendix A: Technology Evaluation Matrix

Only decisions genuinely open to the architect are evaluated; stack items fixed by the
brief are recorded above with rationale rather than re-scored.

| Decision | Option A | Option B | Chosen | Deciding factor |
| --- | --- | --- | --- | --- |
| JSON editor | Monaco | CodeMirror 6 | **B** | Monaco's CDN worker loading breaks the offline/no-backend requirement |
| Canvas interaction | dnd-kit throughout | Custom pointer events | **B** (palette stays A) | Zoom-compensated deltas, snapping and live guides |
| History model | Command/diff | Snapshot | **B** | Correctness per unit effort at kilobyte document sizes |
| Version storage | Diff chain | Full snapshot | **B** | Independent reconstruction, including server-side |
| Document styling | CSS classes | Computed inline | **B** | Must render without our stylesheet |
| Element dispatch | `switch` per surface | Registry | **B** | Extensibility (NFR-011) |
| Condition evaluation | `new Function` | Hand-written evaluator | **B** | Imported templates are untrusted input |

## Appendix B: Capacity Planning

**[Prototype]** The binding constraint is `localStorage` quota (~5 MB/origin), and the
dominant consumer is base64 logo uploads — a single 200 KB logo becomes ~270 KB of data
URL. Practical guidance: dozens of templates are fine; hundreds with embedded imagery are
not. Tracked as R-2.

**[Future]** Server capacity is governed by concurrent headless-Chromium instances (memory,
not CPU-time, is typically the limit), sized against expected renders/minute.

## Appendix C: Cost Estimation

**Prototype:** zero marginal cost — static assets, no services, no third parties.

**[Future] self-hosted:** cost is borne by the customer as container compute on
infrastructure they already own. There is no per-render vendor fee, no data egress, and no
third-party processor in the path — which is a substantive part of the product's
commercial argument for self-hosting, not merely an accounting note.
