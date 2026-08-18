# Technical Specification: Printing a Document from a Calling Application

**Project:** Templify
**Phase:** 2 (Planning) — fills the `tech-spec` slot left optional at project inception
**Date:** 2026-08-18
**Status:** Implemented and verified
**Traces to:** FR-19, FR-20 (product spec), NFR-006, C-11, C-12 (architecture)

---

## Document Overview

The product spec describes what Templify renders. This document describes how a calling
application *gets a document in front of a person and onto paper* — the step every
integrator hits immediately and the one the API reference alone does not answer.

It is written so a developer who has never seen this repository can implement the flow in
any stack. The reference implementation is [`examples/pos-counter-print`](../examples/pos-counter-print),
which runs.

---

## 1. Scenario

A bill is finalised at a shop counter. A popup shows the document. The cashier prints it and
hands the paper to the customer. A customer may return later and ask for a reprint.

Chosen as the canonical scenario because it is the most common reason to reach for a report
server, and because every awkward part of the integration surfaces in it: where the render
happens, what format to ask for, how large to draw the popup, and whether a reprint is
allowed to look different from the original.

### Out of scope

- Payment capture, stock movement, cash drawer, receipt-printer driver configuration.
- Multi-page bills. See §7 — the renderer is capped at one page.

---

## 2. Sequence

```
cashier hits Save & Print
   │
   ├─ 1. save the bill              the calling system. The number exists now.
   ├─ 2. POST templateId + data     Templify. Print-ready markup returns.
   ├─ 3. popup, sized from the doc  the client
   └─ 4. window.print()             the browser, then paper
```

**Ordering is normative.** Step 1 precedes step 2. The document is a view of a bill that
already exists; rendering first means a render failure can leave a customer holding paper for
a sale the system never recorded.

---

## 3. Decisions

**D-C1 · Ask for `format: "html"`, not PDF, when the destination is a printer**
✓ Gain: `iframe.contentWindow.print()` is honoured; returns in milliseconds; identical paper.
✗ Lose: no file on disk; a second call is needed when a file is genuinely wanted.
*Rationale:* three independent reasons converge. A PDF in an iframe is handed to the
browser's built-in viewer, which frequently ignores a scripted `print()` — the button
silently does nothing. The HTML branch returns before `htmlToPdf` is reached, so it never
launches Chromium (~1s saved per bill). And the PDF *is* Chromium printing that same markup,
which carries `@page { size: <w>px <h>px; margin: 0 }`, `print-color-adjust: exact` and
embedded fonts — so print output cannot differ between the two.

**D-C2 · The client measures the document rather than mapping a page-size enum**
✓ Gain: no page-dimension table in any client; a new page size needs no client change.
✗ Lose: depends on the rendered markup exposing its own size.
*Rationale:* `GET /api/templates/:id` publishes the enum (`"A5"`), not pixels, so every
client would otherwise carry its own mm→px table — the duplication Templify exists to
remove — and would fall back to A4 the day a receipt size is added. The rendered document
already states its size as an inline style on the page element
(`<body><div style="width:559px;height:794px">`), so the client reads it from the response it
already has. See §8 for the residual coupling this accepts.

**D-C3 · Scale the document with a transform; do not resize the frame**
✓ Gain: the whole page and the print button fit any window; no scrollbars.
✗ Lose: two nested boxes instead of one.
*Rationale:* the page inside is a fixed-width element. Shrinking the iframe clips it and
gives it its own scrollbars rather than making it smaller. The outer box carries the scaled
footprint the layout sees; the iframe keeps true pixel dimensions and is scaled with
`transform: scale(k)`. The transform lives in the host document, not the frame's, so printed
output is unaffected. `k` is capped at 1 — a compact receipt on a large display stays true
size rather than being enlarged.

**D-C4 · Deliver the markup through `srcDoc`, never a URL**
✓ Gain: same-origin, so the frame can be measured and printed; no second request.
✗ Lose: the markup passes through the host page's memory.
*Rationale:* both `contentWindow.document` (D-C2) and `contentWindow.print()` require
same-origin. A cross-origin `src` is opaque to each, which breaks the whole flow silently.

**D-C5 · Render live for shop bills; store and pin for documents of record**
✓ Gain: no storage, no background job, and the client can own the entire flow.
✗ Lose: a reprint follows the current design, not the design at issue time.
*Rationale:* the numbers come from the saved bill either way, so only the layout drifts —
acceptable for a shop bill, not for a tax invoice or payslip. The split is a per-document
decision, recorded in §5, not a product-wide one. Editing *which fields a template shows*
is the one change that makes a live reprint wrong; template edits under this policy should be
confined to layout and branding.

**D-C6 · The render call is server-side unless the client already holds the data**
✓ Gain: the payload cannot be authored by whoever sits at the browser.
✗ Lose: a hop, and a backend endpoint to maintain.
*Rationale:* whoever composes the payload authors the document, and the document carries the
operator's branding. Where the data is already legitimately on screen and nothing downstream
treats the document as a record, the hop buys nothing — see §6.

---

## 4. Interface used

Only two endpoints are involved. Neither carries page size, orientation, margins or fonts:
all of that belongs to the template.

```http
POST /api/reports/render
Content-Type: application/json
Authorization: Bearer <key>        # only when TEMPLIFY_API_KEY is set

{
  "templateId": "receipt-compact",   // ":vN" to pin — see D-C5
  "data":       { ... },             // paths the template binds to
  "locale":     "en",                // optional; unrecognised falls back to English
  "options":    { "format": "html", "currency": "LKR", "strict": false }
}
```

| Response | Meaning |
| --- | --- |
| `200` + `text/html` | Print-ready markup. Carries `@page`, embedded fonts, inline page dimensions. |
| `200` + `application/pdf` | Same document as a file, when `format` is `"pdf"` or omitted. |
| `400` | `templateId` absent. |
| `404` | Unknown template or pinned version. |
| `422` | `options.strict: true` and the payload was missing bound paths. |
| `500` | PDF conversion failed. Not reachable on the HTML path. |

| Response header | Use |
| --- | --- |
| `X-Templify-Missing-Bindings` | Comma-separated paths that rendered blank. Always present when non-empty. Surface these. |
| `X-Templify-Locale` | The locale actually applied. |

`GET /api/templates/:id` returns the template, including
`page: { size, orientation, margins }`. Needed only when the client must lay out *before* it
has a document; the flow in §2 does not need it.

### Payload contract

The built-in invoice and receipt layouts bind these paths. A payload using different names
renders blank fields and reports them in `X-Templify-Missing-Bindings`.

| Path | Notes |
| --- | --- |
| `company.name`, `.logo`, `.address`, `.email`, `.phone` | `logo` blank renders nothing, not a broken image |
| `customer.name`, `.email`, `.address` | An empty string is *present* and renders blank; an absent key is reported missing |
| `invoice.number`, `.date`, `.dueDate`, `.subtotal`, `.discount`, `.tax`, `.total` | `discount: 0` hides the discount row by template condition |
| `items[]` | Repeater source. Rows bind `item.name`, `item.quantity`, `item.price`, `item.total` |

---

## 5. Document classes

Pick per document type before implementing, because it decides where the render lives.

| Class | Examples | Render | Storage | Version | Reprint |
| --- | --- | --- | --- | --- | --- |
| Transient | Shop bill, receipt, on-screen preview | Live, may be client-side | None | Unpinned | Current design |
| Of record | Tax invoice, payslip, certificate, anything emailed | Server-side | PDF written at issue | Pinned `:vN` | Byte-identical |

For the second class the render must be server-side: a browser cannot write files, and the
pinned handle has to be stored beside the file so the document can be rebuilt if the file is
lost.

---

## 6. Frontend-only viability

Permitted when **all** of the following hold. Otherwise the render belongs on a server.

1. **Same origin.** Templify sends no CORS headers, so a cross-origin browser call is
   discarded. Either Templify serves the page, or a reverse proxy places both on one origin.
2. **Nothing to archive.** A browser cannot write files (D-C5, transient class only).
3. **The data is already legitimately in the browser**, and no third party treats the
   document as authoritative.
4. **`TEMPLIFY_API_KEY` is unset and the instance is not internet-reachable.** A key in
   browser JavaScript is a published key, and Templify's single key also permits
   `DELETE /api/templates/:id` — there is no scoped or render-only key.

Native clients are not exempt from (4). A Flutter, MAUI or Android build has no CORS to stop
it, but a key compiled into an app binary is published to anyone holding the install.

A blanket `/api` proxy re-exposes template writes to the browser. In production, proxy the
render path and deny the rest.

---

## 7. Constraints

| # | Constraint | Consequence for this flow |
| --- | --- | --- |
| K-1 | **One page only.** No pagination, and `page.pdf({ pageRanges: '1' })` caps output. | A bill long enough to overflow is truncated, not continued. Line counts must stay modest. Blocking for production POS use. |
| K-2 | **No receipt/thermal page size.** `PageSize` is `'A4' \| 'A5' \| 'LETTER'`. | An 80mm roll cannot be expressed. A5 on a sheet printer is the nearest fit. Adding one wants content-driven height, so it follows K-1. |
| K-3 | **No silent printing in any browser.** | One click to paper needs Chrome's `--kiosk-printing` (prints to the default printer, no dialog) or a local print agent. Terminal configuration, not application code. |
| K-4 | **Cold renders are slow.** Chromium start-up dominates the first PDF. | Raise HTTP client timeouts to 60s. Defaults are 5s (httpx) to 30s. Not applicable on the HTML path. |
| K-5 | **Framework serialisers may reshape the payload.** Type hints (`$type`, `$values`) move every bound path. | Send plain JSON. A blank document with no missing-binding report usually means an envelope. |

---

## 8. Implementation map

| Concern | In this repository | In a calling application |
| --- | --- | --- |
| Render call | [`src/services/renderClient.ts`](../src/services/renderClient.ts) (C-11) | One HTTP POST |
| Popup: measure, scale, print | [`src/components/DocumentPrintDialog.tsx`](../src/components/DocumentPrintDialog.tsx) (C-12) | Framework-native dialog + iframe |
| Live demonstration | Same Data Demo screen → *Render & print* | — |
| Documentation | Help screen | — |
| Reference implementation | [`examples/pos-counter-print`](../examples/pos-counter-print) | Copy from here |

**Accepted coupling.** D-C2 depends on the rendered document exposing its dimensions as an
inline style on `body > div`, which is `DocumentPage`'s outer element. Should that markup
change shape, every client measuring it breaks at once. The removal is small and known:
publish the computed dimensions in the render response (e.g.
`X-Templify-Page-Width` / `-Height`, available where `X-Templify-Locale` is already set) and
mirror them in the template response. Deferred, not overlooked.

---

## 9. Acceptance criteria

| # | Criterion | How it was verified |
| --- | --- | --- |
| A-1 | The bill exists before a document is requested | Reference implementation writes the record, then renders |
| A-2 | Popup takes the document's shape with no page-size constant in the client | A5 measured 559×794, A4 measured 794×1123 from live renders |
| A-3 | The whole document and the print control fit without scrolling | Scale derived from window size, capped at 1 |
| A-4 | Print output matches the PDF | Both originate in `documentToHtml`; `@page` rule asserted present |
| A-5 | The canonical payload resolves completely | Live render of both templates returned no `X-Templify-Missing-Bindings` |
| A-6 | Unresolved bindings are shown, not swallowed | Header parsed and displayed in the dialog |
| A-7 | The demonstration degrades without a report server | Gated on storage mode; fallback copy asserted by `verify:render` |
| A-8 | Guidance and demonstration exist in-product | 9 `verify:render` assertions across the Help and Demo screens |

Repository checks: `npm run verify` (111), `npm run verify:render` (49), `npm run typecheck`,
`npm run build`.

---

## 10. Deployment notes

- **Same origin.** Development: a dev-server proxy (`/api` → `http://localhost:8080`).
  Production: the web server. Templify itself can serve a client build via
  `TEMPLIFY_STATIC_DIR`, at the cost of the editor UI on that origin.
- **Keep the render path private.** Templify needs no published port when only your
  application calls it; Docker network reachability is sufficient.
- **`shm_size: 512mb`.** Chromium crashes on larger documents with Docker's 64 MB default.
- **Kiosk terminals.** `chrome --kiosk --kiosk-printing --app=<url>` prints to the default
  printer with no dialog. The default printer must be the counter printer, and there is no
  cancel step.
- **The frontend is baked into the image at build time.** Changing in-product guidance
  requires `docker compose up -d --build`.

---

**Created using BMAD Method v6 — Phase 2 (Planning), tech-spec workflow.**
