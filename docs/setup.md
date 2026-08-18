# Setup

Getting Templify running from a clean checkout. Every command below was run on Windows 11
with Node 24.19.0 and Docker Desktop; the outputs quoted are the real ones.

Pick one of two paths:

| | Docker | Node only |
| --- | --- | --- |
| Editor UI | ✅ | ✅ |
| REST API | ✅ | ✅ |
| Shared templates | ✅ persisted to a volume | ⚠️ `localStorage`, per browser, unless you run the server |
| PDF rendering | ✅ Chromium in the image | ⚠️ needs a local Chrome — see B2 |
| Fonts for Sinhala / Tamil | ✅ embedded from pinned packages | ✅ same |

**Docker is the recommended path.** Take the Node path if you are changing the code.

---

## A · Docker

One image, one port, one volume. The editor UI and the API are served together.

```bash
docker compose up -d
```

Open <http://localhost:8080>. Confirm it is healthy:

```bash
curl http://localhost:8080/api/health
```

```json
{"status":"ok","version":"1.1.0","templates":8,"pdf":true,"auth":"open",
 "locales":["en","si","ta","fr","de","es","pt"],"scripts":["latin","sinhala","tamil"]}
```

`"pdf":true` is the one to check — it means headless Chromium started and PDF rendering works.

To pull the published image instead of building:

```bash
docker run -d -p 8080:8080 -v templify:/data --shm-size=512m ghcr.io/kanishkalakmina/templify:latest
```

Three things about this path:

- **`--shm-size=512m` matters.** Chromium crashes on larger documents with Docker's default
  64 MB of shared memory. `docker-compose.yml` already sets it.
- **Templates persist to the volume** (`templify_templify-data` under Compose) and are shared
  by everyone using the instance — which is what makes them addressable by `templateId` from
  your code. Rebuilding the image does not touch it.
- **The frontend is baked into the image at build time.** After changing anything under
  `src/`, run `docker compose up -d --build` or the browser keeps serving the old bundle.

---

## B · Node, no Docker

Requires **Node 20+** (developed against 24.19.0 LTS via [nvs](https://github.com/jasongin/nvs)).

```bash
npm install
```

### B1 · Frontend only — fastest way to look at it

```bash
npm run dev
```

Open <http://localhost:5173>. **No backend needed.** The app probes its own origin for a
report server at boot; finding none, it falls back to `localStorage`. Everything works except
what genuinely needs a server: templates are per-browser rather than shared, and there is no
PDF rendering. The sidebar states which mode you are in rather than pretending.

### B2 · The full server, locally

```bash
npm run build:all
PORT=8080 TEMPLIFY_DATA_DIR=./.data TEMPLIFY_STATIC_DIR=./dist npm start
```

That serves the editor, the API and the templates. But health will report:

```json
{"status":"ok","pdf":false, ...}
```

`puppeteer-core` deliberately bundles no browser, and the default path (`/usr/bin/chromium`)
is the one inside the image. Point it at a browser you already have:

```bash
# Windows — Chrome. Edge works too; it is Chromium underneath.
PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
PORT=8080 TEMPLIFY_DATA_DIR=./.data TEMPLIFY_STATIC_DIR=./dist npm start

# macOS
PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ...

# Linux
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium ...
```

Health then reports `"pdf":true` and renders real PDFs.

> **HTML output needs no browser at all.** `options.format: "html"` returns before Chromium is
> ever reached, so it works on a `pdf:false` server. That is the format to use for printing
> from a browser anyway.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Listen port |
| `TEMPLIFY_DATA_DIR` | `/data` | Where templates persist — mount this in Docker |
| `TEMPLIFY_STATIC_DIR` | `/app/public` | Built frontend assets |
| `TEMPLIFY_API_KEY` | *(unset)* | When set, every `/api/*` call needs `Authorization: Bearer <key>` |
| `TEMPLIFY_RENDER_TIMEOUT_MS` | `30000` | Ceiling on a single render |
| `TEMPLIFY_MAX_BODY` | `8mb` | Request body limit — payloads with base64 logos get large |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | The browser used for PDF rendering |

`TEMPLIFY_API_KEY` is the *only* credential the server accepts. Keys generated on the API
screen are illustrative values for showing the shape of the flow — they are held in memory and
never registered with the server.

---

## Confirming the install

```bash
npm run typecheck        # silent when clean
npm run verify           # 111/111 checks passed
npm run verify:render    # 49/49 checks passed
npm run build            # writes dist/
```

`verify` loads the real domain modules and asserts the behaviour the product depends on —
binding resolution, repeater scope chaining, conditions, version pinning, and that an export
carries no customer data. `verify:render` server-renders every screen to catch crashes and
checks all 26 built-in templates resolve to bound content. Neither needs a running server.

---

## Ports

| Port | What |
| --- | --- |
| 8080 | Templify — editor UI and API |
| 5173 | `npm run dev`, root app |
| 5181 | `examples/pos-counter-print` |

---

## The example application

A till screen that saves a bill, pops up the document and prints it.

```bash
cd examples/pos-counter-print
npm install
npm run dev              # http://localhost:5181
```

It needs Templify running on 8080; its Vite config proxies `/api` there, which is what puts
both on one origin. See [`tech-spec-counter-print.md`](tech-spec-counter-print.md) for why
that matters.

---

## Troubleshooting

**`"pdf": false`, or a render returns `Browser was not found at the configured executablePath`**
No Chromium. Use Docker, or set `PUPPETEER_EXECUTABLE_PATH` — see B2.

**Chromium crashes on larger documents**
Shared memory. `--shm-size=512m`, or `shm_size: "512mb"` in Compose.

**UI changes are not showing on :8080**
The frontend is compiled into the image. `docker compose up -d --build`.

**`401 unauthorized` from `/api/*`**
`TEMPLIFY_API_KEY` is set on the server. Send `Authorization: Bearer <that value>` — not a key
generated on the API screen.

**A CORS error when your own app calls the API**
Expected: Templify sends no CORS headers. Put both on one origin with a proxy rather than
calling port 8080 from a browser page.

**A document renders with blank fields**
The payload is missing paths the template binds to. Every response carries
`X-Templify-Missing-Bindings` listing them; send `options.strict: true` to get a `422` instead.

**`npm warn allow-scripts … esbuild`**
Harmless. npm declined to run esbuild's postinstall; Vite still works.

**Only the first page of a long document appears**
A real limitation, not a misconfiguration: there is no pagination yet and the PDF renderer is
capped at page one. See the known limitations in the README.

---

## Where to go next

| You want to | Read |
| --- | --- |
| Send data and get documents back | The **API** screen, or the README's report-server section |
| Show and print a document in your app | The **Help** screen, then [`tech-spec-counter-print.md`](tech-spec-counter-print.md) |
| Understand the codebase | [`architecture-templify-2026-08-14.md`](architecture-templify-2026-08-14.md) |
| Know what the product must do | [`product-spec-templify.md`](product-spec-templify.md) |
