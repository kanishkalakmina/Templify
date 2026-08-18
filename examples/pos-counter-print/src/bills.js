/**
 * The bill record — this example's stand-in for "your own system".
 *
 * Templify does not store bills. It renders documents. Where the bill itself
 * lives is your application's business, so this file is deliberately the only
 * place that knows: here it is `localStorage`; in a real POS it is a table with
 * a sequence for the bill number.
 *
 * The important part is `toReportData` at the bottom.
 */

const STORAGE_KEY = 'templify-pos-bills'

/** Whose shop this is. In a real POS: one row in a settings table. */
const SHOP = {
  name: 'Serendib Provisions',
  logo: '', // A data: URI or URL. Blank renders nothing rather than a broken image.
  address: '148 Galle Road, Colombo 03',
  email: 'counter@serendib.lk',
  phone: '+94 11 234 5678',
}

const TAX_RATE = 0.15
const FIRST_BILL_NUMBER = 1001

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    // A corrupt key should not brick the till.
    return []
  }
}

/** Newest first — a counter cares about the last few bills, not the first. */
export function listBills() {
  return readAll().slice().reverse()
}

export function clearBills() {
  localStorage.removeItem(STORAGE_KEY)
}

/* -------------------------------------------------------------------------- */
/* Issuing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Saves the bill and assigns its number.
 *
 * This is the moment the bill becomes real, and it happens *before* anything is
 * rendered. The document is a view of a bill that already exists — never the
 * other way round, or a failed render would leave a customer holding paper for
 * a sale the system never recorded.
 */
export function saveBill({ lines, customerName, discount = 0 }) {
  if (!lines.length) throw new Error('Nothing on the bill.')

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const taxable = Math.max(0, subtotal - discount)
  const tax = Math.round(taxable * TAX_RATE)

  const existing = readAll()

  const bill = {
    id: crypto.randomUUID(),
    number: `BILL-${FIRST_BILL_NUMBER + existing.length}`,
    date: new Date().toISOString().slice(0, 10),
    customerName: customerName.trim(),
    lines,
    subtotal,
    discount,
    tax,
    total: taxable + tax,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, bill]))
  return bill
}

/* -------------------------------------------------------------------------- */
/* The mapping                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Bill record -> the payload the template expects.
 *
 * This is the one place where your field names meet the template's binding
 * paths. The built-in invoice and receipt layouts bind to `{{company.name}}`,
 * `{{invoice.total}}`, `{{item.price}}` and so on, so the payload has to use
 * those paths — a bill whose lines were called `products` would render an empty
 * items table and report the miss in `X-Templify-Missing-Bindings`.
 *
 * Keeping the mapping in a single function is what makes the rest of the app
 * ignorant of the template. Point it at a different layout and nothing else
 * changes.
 */
export function toReportData(bill) {
  return {
    company: SHOP,

    // A walk-in sale has no customer on file, but the layout has a "Bill to"
    // block. An empty string is *present* and renders blank; a missing key is
    // reported as an unresolved binding. Say "Walk-in" and mean it.
    customer: {
      name: bill.customerName || 'Walk-in customer',
      email: '',
      address: '',
    },

    invoice: {
      number: bill.number,
      date: bill.date,
      dueDate: bill.date, // Paid at the counter, so it is due the day it is issued.
      subtotal: bill.subtotal,
      discount: bill.discount,
      tax: bill.tax,
      total: bill.total,
    },

    // `items` is the repeater's data source, and each row binds `item.name`,
    // `item.quantity`, `item.price`, `item.total`.
    items: bill.lines,
  }
}
