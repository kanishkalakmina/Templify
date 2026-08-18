# Counter print — save, popup, print

A till screen. Ring up items, hit **Save & Print**, and the bill opens in a popup with the
print dialog already up. The cashier prints it and hands it over.

No backend of its own. The only two things this app talks to are `localStorage` (standing in
for wherever your bills are actually stored) and Templify.

```bash
npm install
npm run dev          # http://localhost:5181
```

Templify must be running on `:8080` — `docker compose up -d` in the repository root.

---

## What it demonstrates

**The popup is never told what paper size the bill is.** There is no `A4: 794×1123` table
anywhere in this app. Templify's markup carries its own dimensions as an inline style, so
[`BillPreview.jsx`](src/BillPreview.jsx) loads the document, measures it, and takes that
shape. Switch the template picker between *Receipt Compact* (A5) and *Invoice Modern* (A4)
and watch the popup change shape with no code change.

**It scales to fit, so there is no scrollbar.** A4 is 1123px tall and overflows most laptop
windows. The popup shrinks the document with a CSS transform until the whole bill and the
Print button are visible together — never scaling *up*, so a small receipt on a big screen
stays at its true size. Shrinking the iframe itself would only clip a fixed-width document
and give it its own scrollbars. The transform is visual and lives in the parent page, so
printed paper still comes out at the size the template says.

**HTML, not PDF.** [`templify.js`](src/templify.js) asks for `format: 'html'` — not for
debugging, but because it is the only reliable way to print from a browser:
`iframe.contentWindow.print()` works on HTML and is frequently ignored on an embedded PDF.
It also skips Chromium, so it returns in milliseconds rather than about a second. The PDF is
Chromium printing that same markup, so the paper is identical either way.

**Save first, render second.** [`App.jsx`](src/App.jsx) writes the bill and assigns its
number *before* asking for a document. A render that fails must never leave a customer
holding paper for a sale the system did not record.

**One mapping, one place.** `toReportData` in [`bills.js`](src/bills.js) is the only function
that knows the template's binding paths (`company.name`, `invoice.total`, `item.price`).
Everything else is ignorant of the layout.

**Unresolved bindings are shown, not swallowed.** Every render returns
`X-Templify-Missing-Bindings`; the popup lists them rather than letting blank fields print
unnoticed.

**Conditions live in the template.** Leave the discount at 0 and the discount row disappears
from the document — that is a condition on the template, not an `if` in this app.

---

## Why the Vite proxy is load-bearing

Templify sends no CORS headers, so a page on `:5181` cannot call `:8080` — the browser
discards the response. [`vite.config.js`](vite.config.js) proxies `/api`, which makes them
one origin and buys two things:

1. The browser is allowed to call the render endpoint at all.
2. The popup can read the document inside its own iframe. Measuring and scripted printing
   both require same-origin, which `srcDoc` preserves and a cross-origin `src` would not.

In production that proxy is your web server (nginx, IIS, Caddy) rather than Vite.

---

## What this example deliberately does not do

- **No stored copy of the document.** A browser cannot write files. Reprint re-renders live,
  which means an old bill reprinted after a template edit carries the *new* design. The
  numbers are always right — they come from the saved bill — but the layout follows whatever
  the template looks like today. For a shop bill that is fine; for a tax invoice, render
  server-side, store the PDF, and pin the version (`invoice-modern:v3`).
- **No API key.** Frontend-only means any key would be visible in the browser, and Templify's
  single key also permits deleting templates. So this pattern is for a till on your own
  network with `TEMPLIFY_API_KEY` unset — not for anything internet-facing.
- **No silent printing.** No browser allows it. One click straight to paper needs Chrome's
  `--kiosk-printing` flag or a local print agent, whatever generates the document.
- **One page only.** Templify does not paginate yet, and the renderer is capped at the first
  page, so a bill long enough to overflow is truncated. Keep the item count modest until
  pagination lands.

---

## Files

| File | What it holds |
| --- | --- |
| [`src/App.jsx`](src/App.jsx) | Till screen, the save-then-render flow, reprint |
| [`src/BillPreview.jsx`](src/BillPreview.jsx) | The popup: measures the document, auto-prints |
| [`src/templify.js`](src/templify.js) | The only file that calls Templify |
| [`src/bills.js`](src/bills.js) | Bill records and the payload mapping |
| [`src/catalog.js`](src/catalog.js) | Counter stock — stands in for your product table |
