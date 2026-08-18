# Contributing to Templify

Thanks for taking an interest. Templify is a self-hosted report template platform:
**your application owns the data, Templify owns the document design.** Keeping that
sentence true is what most of the rules below are protecting.

- **Bugs and features** → open an [issue](https://github.com/kanishkalakmina/Templify/issues)
- **Questions and ideas** → open a [discussion](https://github.com/kanishkalakmina/Templify/discussions)
- **New here?** → issues labelled [`good first issue`](https://github.com/kanishkalakmina/Templify/labels/good%20first%20issue)

---

## Getting set up

You need **Node 20 or newer** (CI runs 24) and, optionally, Docker.

```bash
git clone https://github.com/kanishkalakmina/Templify.git
cd Templify
npm install
npm run dev
```

That serves the editor at <http://localhost:5173> with no backend — templates persist to
`localStorage`. The sidebar tells you which mode you are in.

To run the full thing, API and PDF rendering included:

```bash
docker compose up -d
```

Editor and API both land on <http://localhost:8080>.

---

## Before you open a pull request

```bash
npm run build:all      # type checks app, node and server projects, then bundles
npm run verify         # domain checks — binding, conditions, versioning, export safety
npm run verify:render  # renders every screen and all 26 built-in templates
```

All three must pass. CI runs them, plus a Docker build and an end-to-end smoke test that
renders every built-in template to a real PDF.

### The verify scripts are not enough on their own

This is the most useful thing to know about this codebase. Three separate bugs have shipped
past a fully green suite:

- literal text in a key/value row rendering blank,
- KPI cards rendering their label with no value,
- bar charts rendering as full-width slabs.

Every one passed the checks and was only caught by **rendering a document and looking at
it**. If your change touches rendering, layout or the built-in templates, open the editor or
render a PDF and look at the output before you push. Then add a check so the next person
does not have to.

```bash
# Render one template to a PDF from a running container
curl -X POST http://localhost:8080/api/reports/render \
  -H 'Content-Type: application/json' \
  -d '{"templateId":"invoice-modern","data":{ ... }}' \
  -o out.pdf
```

`"options": {"format": "html"}` returns the markup instead, which is far easier to inspect
than a binary.

---

## Architecture rules

These are not style preferences. Breaking one of them breaks a product promise, so a PR
that does will be asked to change.

**1. `src/types/` and `src/services/` must never import React.**
The server imports those modules unchanged to render PDFs. That reuse is the only reason a
PDF cannot drift from what the editor shows. If you need React, you are in the wrong layer.

**2. There is exactly one renderer.**
`resolveDocument()` produces a projection; `ElementRenderer` turns it into DOM. The canvas,
the preview, the library thumbnails and the server all consume that same pair. Adding a
second rendering path is how preview fidelity rots.

**3. Layers only depend downward.** UI → State → Domain → Schema. Never the reverse.

**4. Built-in templates are data, not components.**
A template is a `ReportTemplate` literal in `src/templates/builtin/`. That is what lets one
be duplicated, versioned, exported and server-rendered like any user template.

**5. No invoice-specific logic in the editor.**
An invoice is just data plus elements in the generic schema. The same editor has to serve
quotations, certificates, payslips and audit reports without changes.

**6. Document styling is computed inline, not Tailwind.**
Application chrome uses Tailwind. The printable document does not — it has to render
identically in headless Chromium, which never loads the app's stylesheet.

**7. Never `eval` a template.**
Conditions go through the hand-written evaluator in `services/conditions.ts`. A `.templify`
file is untrusted input.

**8. Exports carry no customer data.**
`exportService` has no reference to the test-data store, and it should stay that way.

---

## Adding things

**A new element type** needs two entries: a factory in `services/elementFactory.ts` and
palette metadata in `editor/palette.ts`. Nothing else in the editor should need touching —
if it does, that is a design smell worth raising in the PR.

**A new built-in template** is usually an option set over an existing architecture in
`templates/builtin/layouts.ts` (`doc`, `report`, `certificate`, `payslip`), added to
`LIBRARY_GROUPS`. Render it before submitting.

**A new language** goes in `src/i18n/`. Non-Latin scripts also need a font registered in
`server/fonts.ts`, or the PDF renders empty boxes with no error.

---

## Pull requests

1. Branch from `main` — `feature/...`, `fix/...` or `docs/...`
2. Keep it to one feature or fix. Small PRs get reviewed; large ones stall.
3. Run the three commands above.
4. Say **what changed and why**. If it affects rendering, include a screenshot or a PDF.
5. Open the PR against `main`.

`main` is protected: everything lands through a pull request with CI green.

### Commit messages

Explain the *why*, not just the what. The subject is a short imperative sentence; the body
covers reasoning, trade-offs and anything a future reader would otherwise have to guess.

```
Fix literal text being swallowed in key/value rows

resolveValue treats a bare string as a data path, which is right for a
dataSource but wrong for content ...
```

---

## What is deliberately out of scope

The brief this was built from rules these out, so please raise an issue before building
them: **email sending, monitoring/telemetry, payments, CRM features.**

Known gaps that *are* fair game — see the roadmap in the README: pagination across pages,
real QR/barcode encoding, authentication, and an automated test suite.

---

## Reporting security issues

Please do not open a public issue. See [SECURITY.md](SECURITY.md).
