/**
 * Counter stock.
 *
 * Stands in for wherever your POS reads products from — a table, a barcode
 * scanner, an ERP lookup. Nothing here is Templify's business; it exists so the
 * cashier has something to ring up.
 *
 * Prices are whole rupees. No formatting is applied anywhere in this app —
 * Templify formats currency at render time from the `currency` option, so the
 * same bill renders as Rs 1,450.00 or $1,450.00 without this file changing.
 */
export const CATALOG = [
  { sku: 'TEA-250', name: 'Ceylon Black Tea 250g', price: 1450 },
  { sku: 'CIN-100', name: 'Cinnamon Sticks 100g', price: 980 },
  { sku: 'CSH-500', name: 'Cashew Nuts 500g', price: 4200 },
  { sku: 'COC-1L', name: 'Virgin Coconut Oil 1L', price: 2350 },
  { sku: 'PPR-200', name: 'Black Pepper 200g', price: 1120 },
  { sku: 'JAG-400', name: 'Kithul Jaggery 400g', price: 890 },
  { sku: 'RCE-5K', name: 'Red Raw Rice 5kg', price: 3150 },
  { sku: 'BAG-01', name: 'Reusable Carrier Bag', price: 120 },
]
