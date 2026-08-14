/**
 * Sample report payloads.
 *
 * These stand in for what a customer application would POST to
 * `/api/reports/render`. They are developer-facing sample data — never customer
 * records — and they are what the "Same Data. Different Design." screen holds
 * fixed while the template changes.
 */

import type { ReportData } from '@/types/data'

/**
 * The canonical payload from the specification.
 *
 * Note on the totals: the brief's JSON listed `subtotal: 50000` alongside two
 * line items summing to 55,000, while the invoice layout in the same brief shows
 * 55,000. The arithmetic is reconciled here so the rendered document is
 * internally consistent — a demo whose totals do not add up undermines the
 * point it is making.
 */
export const DEFAULT_TEST_DATA: ReportData = {
  company: {
    name: 'Acme Technologies',
    logo: '',
    address: 'Colombo, Sri Lanka',
    email: 'hello@acme.com',
    phone: '+94 77 123 4567',
  },
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    address: 'Colombo, Sri Lanka',
  },
  invoice: {
    number: 'INV-1001',
    date: '2026-08-14',
    dueDate: '2026-08-30',
    subtotal: 55000,
    discount: 0,
    tax: 0,
    total: 55000,
  },
  items: [
    { name: 'Website Development', quantity: 1, price: 50000, total: 50000 },
    { name: 'Hosting', quantity: 1, price: 5000, total: 5000 },
  ],
}

/** A richer payload: discount and tax non-zero, so conditional rows appear. */
export const EXTENDED_INVOICE_DATA: ReportData = {
  company: {
    name: 'Acme Technologies',
    logo: '',
    address: 'Colombo, Sri Lanka',
    email: 'hello@acme.com',
    phone: '+94 77 123 4567',
  },
  customer: {
    name: 'Nimal Perera',
    email: 'nimal@bluewave.lk',
    address: 'Kandy, Sri Lanka',
  },
  invoice: {
    number: 'INV-1042',
    date: '2026-08-14',
    dueDate: '2026-09-13',
    subtotal: 182500,
    discount: 12500,
    tax: 25500,
    total: 195500,
  },
  items: [
    { name: 'Platform Discovery Workshop', quantity: 2, price: 35000, total: 70000 },
    { name: 'API Integration', quantity: 1, price: 62500, total: 62500 },
    { name: 'Design System', quantity: 1, price: 40000, total: 40000 },
    { name: 'Annual Hosting', quantity: 1, price: 10000, total: 10000 },
  ],
}

export const SAMPLE_PAYLOADS: { id: string; label: string; description: string; data: ReportData }[] = [
  {
    id: 'default',
    label: 'Standard invoice',
    description: 'Two line items, no discount or tax.',
    data: DEFAULT_TEST_DATA,
  },
  {
    id: 'extended',
    label: 'Invoice with discount and tax',
    description: 'Exercises conditional rows and larger tables.',
    data: EXTENDED_INVOICE_DATA,
  },
]

/** Pretty-printed default, used to seed the JSON editor. */
export const DEFAULT_TEST_DATA_JSON = JSON.stringify(DEFAULT_TEST_DATA, null, 2)
