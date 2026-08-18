import { PageBody } from '@/app/AppShell'
import { CodeBlock } from '@/components/CodeBlock'
import { SERVER } from '@/data/server'

/**
 * In-app integration guide, written around one concrete scenario: a bill is
 * generated at a counter, a popup shows it, the user prints it and hands it to a
 * customer.
 *
 * That case is chosen deliberately over a generic tour. It is the most common
 * reason to reach for a report server, and every awkward part of the integration
 * shows up in it — where to render, what format to ask for, how big to draw the
 * popup, and what happens on a reprint.
 *
 * The code here is the code in `examples/pos-counter-print`, which runs.
 */

const SAVE_FIRST = `// Save the bill BEFORE rendering anything.
//
// The document is a view of a bill that already exists. Render first and a
// failure leaves a customer holding paper for a sale you never recorded.
async function onSaveAndPrint(cart) {
  const bill = await fetch('/api/bills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cart),
  }).then(r => r.json())          // -> { number: 'BILL-1001', total: 8165, ... }

  const doc = await renderBill(bill)
  setPreview(doc)                 // opens the popup
}`

const RENDER = `// One call. Note what is NOT sent: paper size, orientation, margins,
// fonts. All of that lives with the template, which is why switching a
// bill from A4 to A5 is an edit in the editor and not a change here.
async function renderBill(bill) {
  const response = await fetch('/api/reports/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'receipt-compact',
      data: {
        company:  SHOP,
        customer: { name: bill.customerName || 'Walk-in customer', email: '', address: '' },
        invoice:  { number: bill.number, date: bill.date, total: bill.total, /* ... */ },
        items:    bill.lines,     // repeater source; rows bind item.name, item.price
      },
      options: { format: 'html', currency: 'LKR' },
    }),
  })

  if (!response.ok) throw new Error(\`Render failed (\${response.status})\`)

  // Always reported, never fatal: paths the template wanted and the payload
  // lacked. They print blank, which on a bill is worth surfacing.
  const missing = response.headers.get('X-Templify-Missing-Bindings')

  return {
    html: await response.text(),
    missing: missing ? missing.split(',') : [],
  }
}`

const POPUP = `// The popup is never told what paper size the bill is.
//
// Templify's markup carries its own dimensions as an inline style:
//   <body><div style="width:559px;height:794px"> ... </div></body>
// So load it, measure it, and take that shape. A page size added to
// Templify next year works here with no change.

function BillPreview({ html, onClose }) {
  const frame = useRef(null)
  const [size, setSize]   = useState(null)
  const [scale, setScale] = useState(1)

  function measure() {
    const page = frame.current.contentWindow.document.body.firstElementChild
    setSize({ width: page.offsetWidth, height: page.offsetHeight })

    frame.current.contentWindow.focus()   // focus first, or print() is ignored
    frame.current.contentWindow.print()
  }

  // Shrink to fit the window. Never scale UP — a small receipt on a big
  // screen should stay its true size, not become a blurry poster.
  useEffect(() => {
    if (!size) return
    const refit = () => setScale(Math.min(1,
      (window.innerWidth  * 0.86) / size.width,
      (window.innerHeight * 0.72) / size.height,
    ))
    refit()
    window.addEventListener('resize', refit)
    return () => window.removeEventListener('resize', refit)
  }, [size])

  // TWO boxes. The outer one is the scaled footprint the layout sees; the
  // iframe keeps the document's true size and is shrunk with a transform.
  // Shrinking the iframe itself would clip a fixed-width document and give
  // it scrollbars instead of making it smaller.
  return (
    <div style={{ width: size.width * scale, height: size.height * scale, overflow: 'hidden' }}>
      <iframe
        ref={frame}
        srcDoc={html}
        onLoad={measure}
        style={{
          width: size.width, height: size.height,
          transform: \`scale(\${scale})\`,
          transformOrigin: 'top left',
          border: 0,
        }}
      />
    </div>
  )
}`

const PROXY = `// Templify sends no CORS headers, so a page on :5181 cannot call :8080 —
// the browser discards the response. Proxying /api makes them one origin.
//
// That single line buys two things: the browser may call the render
// endpoint at all, and the popup may READ its own iframe. Measuring and
// scripted printing both require same-origin, which srcDoc preserves.

// vite.config.js — development
export default defineConfig({
  server: { proxy: { '/api': '${SERVER.url}' } },
})

# nginx — production
location /api/ {
  proxy_pass http://templify:8080/api/;
  proxy_read_timeout 120s;      # a cold render takes seconds
}`

const SERVER_SIDE = `// When the document must be reproducible — a tax invoice, a payslip —
// render server-side, store the file, and pin the version.
app.post('/invoices/:id/issue', async (req, res) => {
  const invoice = await db.getInvoice(req.params.id)

  const pdf = await fetch('${SERVER.internalHost}/api/reports/render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${process.env.${SERVER.envVar}}\`,
    },
    // Pinned: a later design change cannot alter this document.
    body: JSON.stringify({ templateId: 'invoice-modern:v3', data: invoice }),
  }).then(r => r.arrayBuffer())

  const pdfPath = \`/storage/invoices/\${invoice.number}.pdf\`
  await fs.writeFile(pdfPath, Buffer.from(pdf))

  // Serve THIS file from now on. Reprints stop re-rendering.
  await db.updateInvoice(invoice.id, {
    status: 'sent', pdfPath, templateVersion: 'invoice-modern:v3',
  })
  res.json({ ok: true })
})`

export function HelpPage() {
  return (
    <PageBody width={940}>
      <div className="text-[22px] font-semibold tracking-[-.4px]">
        Printing a document from your application
      </div>
      <div className="mt-[6px] text-[13px] text-muted">
        A bill is generated, a popup shows it, the user prints it and hands it over.
      </div>

      {/* ---------------------------------------------------------------- idea */}
      <Section title="The shape of it">
        <p>
          Your application owns the data. Templify owns the document design. You send a
          template ID and a JSON payload; you get the document back.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-toolbar p-4 font-mono text-[11.5px] leading-[1.9] text-ink-3">
          <pre>{`cashier hits Save & Print
   │
   ├─ 1. save the bill          your system — the number exists now
   ├─ 2. POST templateId + data Templify — print-ready markup back
   └─ 3. popup + print          the browser`}</pre>
        </div>
        <Callout>
          There is <strong>no link you can embed directly</strong>. The render endpoint is a
          POST, and an <code className="font-mono text-accent-link">&lt;iframe src&gt;</code>{' '}
          issues a GET with no body — so nothing exists to point a frame at until you have
          sent the data. That is the one constraint the rest of this page works around.
        </Callout>
        <p className="mt-3">
          It is one HTTP call with a JSON body, so there is no SDK and no supported-language
          list. The snippets below are JavaScript because the popup is; the render call itself
          is the same three lines in C#, Python, Java or Dart.
        </p>
      </Section>

      {/* ---------------------------------------------------------- 1. save it */}
      <Section title="1. Save the bill first">
        <p>
          Order matters here, and it is the mistake that costs the most. Write the bill and
          assign its number <strong>before</strong> asking for a document — otherwise a failed
          render leaves a customer holding paper for a sale your system never recorded.
        </p>
        <div className="mt-3">
          <CodeBlock title="your app · save, then render" code={SAVE_FIRST} />
        </div>
      </Section>

      {/* -------------------------------------------------------- 2. render it */}
      <Section title="2. Ask for HTML, not PDF">
        <p>
          Counter-intuitive, and the single most useful thing on this page.{' '}
          <code className="font-mono text-accent-link">options.format: &quot;html&quot;</code>{' '}
          is not a debugging aid — it is the right transport for anything you intend to print
          from a browser:
        </p>
        <ul className="mt-2 flex list-none flex-col gap-2 p-0">
          <Bullet label="Print actually works">
            <code className="font-mono text-accent-link">contentWindow.print()</code> works on
            markup. Point an iframe at a PDF and the browser hands it to its built-in viewer,
            which frequently ignores a scripted print — your button silently does nothing.
          </Bullet>
          <Bullet label="It is instant">
            The HTML path never touches Chromium, so it returns in milliseconds instead of
            about a second. At a counter with a queue, that is the difference you feel.
          </Bullet>
          <Bullet label="It is not a lesser version">
            The PDF <em>is</em> Chromium printing this same markup, and it carries{' '}
            <code className="font-mono text-accent-link">
              @page &#123; size: …; margin: 0 &#125;
            </code>{' '}
            plus embedded fonts. Same paper either way.
          </Bullet>
        </ul>
        <div className="mt-3">
          <CodeBlock title="the only call to Templify" code={RENDER} />
        </div>
        <p className="mt-3">
          Ask for <code className="font-mono text-accent-link">format: &quot;pdf&quot;</code>{' '}
          when a <em>file</em> has to exist — emailing, downloading, archiving.
        </p>
      </Section>

      {/* --------------------------------------------------------- 3. show it */}
      <Section title="3. Show it, sized from the document">
        <p>
          Do not hardcode A4. The markup already knows its own size, so measure it rather than
          keeping a table of page dimensions in every application you write.
        </p>
        <div className="mt-3">
          <CodeBlock title="the popup" code={POPUP} />
        </div>
        <p className="mt-3">
          The two-box arrangement at the bottom is the part worth reading twice. Shrinking the
          iframe does not shrink the document — the page inside is a fixed-width element, so it
          gets clipped and grows its own scrollbars. Scale it instead. The transform lives in
          your page rather than the frame&rsquo;s, so printed output is unaffected.
        </p>
      </Section>

      {/* ------------------------------------------------------------- 4. cors */}
      <Section title="4. Put Templify on your own origin">
        <p>
          Templify sends no CORS headers, so a browser page cannot call it on port 8080
          directly. Route it through your own origin — which also keeps any API key on the
          server, where it belongs.
        </p>
        <div className="mt-3">
          <CodeBlock title="dev and production" code={PROXY} />
        </div>
        <p className="mt-3">
          Native clients get no free pass. A Flutter or MAUI build has no CORS to stop it, but
          a key compiled into an app binary is a published key — anyone holding the install
          holds the key.
        </p>
      </Section>

      {/* ---------------------------------------------------------- 5. archive */}
      <Section title="5. Decide whether a reprint may look different">
        <p>
          Everything above renders live, so a reprint next month uses next month&rsquo;s
          design. The <strong>numbers never change</strong> — they come from the saved bill —
          but the layout follows whatever the template looks like today.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-toolbar text-left text-faint">
                <th className="px-3 py-2 font-medium">Document</th>
                <th className="px-3 py-2 font-medium">Approach</th>
                <th className="px-3 py-2 font-medium">Reprint</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              <tr className="border-t border-line">
                <td className="px-3 py-2">Shop bill, receipt</td>
                <td className="px-3 py-2">Render live, no storage</td>
                <td className="px-3 py-2 text-ok">Current design — fine</td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-3 py-2">Tax invoice, payslip, certificate</td>
                <td className="px-3 py-2">Render server-side, store the PDF, pin the version</td>
                <td className="px-3 py-2 text-ok">Byte-identical</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          For the second row the render moves to your server, because a browser cannot write
          files — and that is also where the API key can live.
        </p>
        <div className="mt-3">
          <CodeBlock title="issue once, then serve the stored file" code={SERVER_SIDE} />
        </div>
      </Section>

      {/* ------------------------------------------------------------- gotchas */}
      <Section title="Things that will trip you up">
        <ul className="flex list-none flex-col gap-[10px] p-0">
          <Gotcha label="Only the first page renders">
            Templify does not paginate yet, and the PDF renderer is capped at page one. A bill
            long enough to overflow is truncated rather than continued — keep line counts
            modest until that lands.
          </Gotcha>
          <Gotcha label="Missing data fails quietly">
            A payload missing a path the template uses renders a blank field. Every response
            carries{' '}
            <code className="font-mono text-accent-link">X-Templify-Missing-Bindings</code>;
            send <code className="font-mono text-accent-link">options.strict: true</code> to
            get a 422 instead. Show them, rather than letting blanks print unnoticed.
          </Gotcha>
          <Gotcha label="Send plain JSON">
            The payload is your data at the paths the template binds to. Serialisers that wrap
            values in type hints — <code className="font-mono text-accent-link">$type</code>,{' '}
            <code className="font-mono text-accent-link">$values</code> — move every path and
            render a blank document.
          </Gotcha>
          <Gotcha label="Raise your HTTP client's timeout">
            httpx allows 5s by default, many Java and .NET wrappers 10–30s. A cold PDF render
            can pass that and surface as a timeout rather than a render error. Use 60s.
          </Gotcha>
          <Gotcha label="No browser can print silently">
            One click straight to paper needs Chrome&rsquo;s{' '}
            <code className="font-mono text-accent-link">--kiosk-printing</code> flag or a
            local print agent. Nothing about the document source changes that.
          </Gotcha>
        </ul>
      </Section>

      {/* ------------------------------------------------------------- example */}
      <Section title="See it running">
        <p>
          The <strong>Same Data Demo</strong> screen has a{' '}
          <em>Render &amp; print</em> button that does exactly this against this server — the
          real endpoint, the real popup, sized from the document.
        </p>
        <p className="mt-2">
          For the whole scenario end to end, the repository carries a till screen built on the
          code above: ring up items, save the bill, print it.
        </p>
        <div className="mt-3">
          <CodeBlock
            title="run it"
            code={`cd examples/pos-counter-print
npm install
npm run dev     # http://localhost:5181`}
          />
        </div>
        <p className="mt-3 text-faint">
          It needs this server running, which it is if you are reading this page.
        </p>
      </Section>
    </PageBody>
  )
}

/* -------------------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      <div className="flex flex-col text-[12.5px] leading-relaxed text-muted [&>p]:m-0">
        {children}
      </div>
    </section>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-[rgba(91,124,250,.35)] bg-[rgba(91,124,250,.08)] p-[14px] text-[12.5px] leading-relaxed text-ink-2">
      {children}
    </div>
  )
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="text-[12.5px] leading-relaxed text-muted">
      <span className="font-medium text-ink">{label}.</span> {children}
    </li>
  )
}

function Gotcha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-line bg-toolbar p-[13px]">
      <div className="text-[12.5px] font-medium text-ink">{label}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-muted">{children}</div>
    </li>
  )
}
