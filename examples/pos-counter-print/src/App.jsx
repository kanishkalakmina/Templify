import { useEffect, useMemo, useState } from 'react'
import { CATALOG } from './catalog.js'
import { listBills, saveBill, clearBills, toReportData } from './bills.js'
import { listTemplates, renderBillHtml } from './templify.js'
import { BillPreview } from './BillPreview.jsx'

/**
 * Built-ins worth demonstrating that may not be saved on the server.
 *
 * `GET /api/templates` returns templates saved to Templify's data volume. The 26
 * built-in layouts resolve by id regardless, so a couple are merged in — and
 * `receipt-compact` is the interesting one, because it is A5 while the invoices
 * are A4. Switch between them and watch the popup change shape without this app
 * knowing either size.
 */
const EXTRA_TEMPLATES = [
  { id: 'receipt-compact', name: 'Receipt Compact · A5 built-in' },
  { id: 'invoice-modern', name: 'Invoice Modern · A4 built-in' },
]

export function App() {
  const [templates, setTemplates] = useState(EXTRA_TEMPLATES)
  const [templateId, setTemplateId] = useState('receipt-compact')

  const [quantities, setQuantities] = useState({}) // sku -> qty
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState(0)

  const [autoPrint, setAutoPrint] = useState(true)
  const [bills, setBills] = useState(() => listBills())
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /* Templates come from Templify, not from a list in this app. */
  useEffect(() => {
    listTemplates()
      .then((saved) => {
        const seen = new Set(saved.map((t) => t.id))
        setTemplates([...saved, ...EXTRA_TEMPLATES.filter((t) => !seen.has(t.id))])
      })
      .catch((err) => setError(`${err.message} — is Templify running on :8080?`))
  }, [])

  const lines = useMemo(
    () =>
      CATALOG.filter((product) => quantities[product.sku] > 0).map((product) => ({
        name: product.name,
        quantity: quantities[product.sku],
        price: product.price,
        total: product.price * quantities[product.sku],
      })),
    [quantities],
  )

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)

  function add(sku, delta) {
    setQuantities((current) => {
      const next = Math.max(0, (current[sku] ?? 0) + delta)
      return { ...current, [sku]: next }
    })
  }

  /**
   * The whole flow, in the order it has to happen.
   *
   * Save first, render second. The document is a view of a bill that already
   * exists — a render that fails must never leave the customer holding paper for
   * a sale the system did not record.
   */
  async function saveAndPrint() {
    setBusy(true)
    setError('')
    try {
      const bill = saveBill({ lines, customerName, discount })
      const { html, missing } = await renderBillHtml(templateId, toReportData(bill))

      setBills(listBills())
      setQuantities({})
      setCustomerName('')
      setDiscount(0)
      setPreview({ bill, html, missing })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Reprint is the same render call again — there is no stored file.
   *
   * A deliberate choice: the numbers come from the saved bill, so a reprint is
   * always correct, and only the design follows whatever the template looks like
   * today. Pin the template id (`invoice-modern:v3`) if a reprint must be
   * byte-identical to the original instead.
   */
  async function reprint(bill) {
    setBusy(true)
    setError('')
    try {
      const { html, missing } = await renderBillHtml(templateId, toReportData(bill))
      setPreview({ bill, html, missing })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Counter</h1>
          <p className="dim">
            Templify renders the bill. This app owns the sale — and holds no layout, no paper
            size and no PDF code.
          </p>
        </div>

        <label className="field">
          <span>Bill template</span>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <main className="columns">
        {/* ------------------------------------------------------------ stock */}
        <section className="panel">
          <h2>Stock</h2>
          <div className="stock">
            {CATALOG.map((product) => (
              <button key={product.sku} className="product" onClick={() => add(product.sku, 1)}>
                <span className="product-name">{product.name}</span>
                <span className="dim">{product.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- bill */}
        <section className="panel">
          <h2>This bill</h2>

          {lines.length === 0 ? (
            <p className="dim empty">Tap an item to start.</p>
          ) : (
            <table className="lines">
              <tbody>
                {CATALOG.filter((p) => quantities[p.sku] > 0).map((product) => (
                  <tr key={product.sku}>
                    <td>{product.name}</td>
                    <td className="qty">
                      <button onClick={() => add(product.sku, -1)}>−</button>
                      <span>{quantities[product.sku]}</span>
                      <button onClick={() => add(product.sku, 1)}>+</button>
                    </td>
                    <td className="num">
                      {(product.price * quantities[product.sku]).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <label className="field">
            <span>Customer (optional)</span>
            <input
              value={customerName}
              placeholder="Walk-in customer"
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Discount</span>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <p className="dim hint">
            Leave the discount at 0 and the discount row disappears from the document — the
            template hides it with a condition, not this app.
          </p>

          <div className="total">
            <span>Subtotal</span>
            <strong>{subtotal.toLocaleString()}</strong>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
            />
            <span>Open the print dialog automatically</span>
          </label>

          <button
            className="primary"
            disabled={busy || lines.length === 0}
            onClick={saveAndPrint}
          >
            {busy ? 'Working…' : 'Save & Print'}
          </button>
        </section>
      </main>

      {/* -------------------------------------------------------------- bills */}
      <section className="panel">
        <h2>
          Today&rsquo;s bills
          {bills.length > 0 ? (
            <button
              className="ghost small"
              onClick={() => {
                clearBills()
                setBills([])
              }}
            >
              Clear
            </button>
          ) : null}
        </h2>

        {bills.length === 0 ? (
          <p className="dim empty">Nothing yet.</p>
        ) : (
          <table className="lines">
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <strong>{bill.number}</strong>
                    <span className="dim"> · {bill.customerName || 'Walk-in customer'}</span>
                  </td>
                  <td className="num">{bill.total.toLocaleString()}</td>
                  <td>
                    <button onClick={() => reprint(bill)} disabled={busy}>
                      Reprint
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {preview ? (
        <BillPreview
          bill={preview.bill}
          html={preview.html}
          missing={preview.missing}
          autoPrint={autoPrint}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  )
}
