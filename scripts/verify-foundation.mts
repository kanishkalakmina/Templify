/**
 * Runtime smoke check for the foundation layer.
 *
 * Loads the real modules through Vite (so the `@/` alias and TypeScript resolve
 * exactly as they do in the app) and asserts the behaviour the product depends
 * on: binding resolution, scope chaining, condition evaluation, versioning and
 * the export data-safety invariant.
 *
 * Run with:  npm run verify
 */

import { createServer } from 'vite'

let failures = 0
let checks = 0

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`)
  }
}

function section(name: string) {
  console.log(`\n${name}`)
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const binding = await server.ssrLoadModule('/src/services/binding.ts')
  const conditions = await server.ssrLoadModule('/src/services/conditions.ts')
  const versioning = await server.ssrLoadModule('/src/services/versioning.ts')
  const catalog = await server.ssrLoadModule('/src/services/templateCatalog.ts')
  const exportService = await server.ssrLoadModule('/src/services/exportService.ts')
  const resolver = await server.ssrLoadModule('/src/services/resolveDocument.ts')
  const factory = await server.ssrLoadModule('/src/services/elementFactory.ts')
  const sample = await server.ssrLoadModule('/src/data/sampleData.ts')

  const data = sample.DEFAULT_TEST_DATA
  const scope = binding.rootScope(data)

  section('Binding — paths and formatting')
  check('nested path', binding.interpolate('{{customer.name}}', scope), 'John Doe')
  check('mixed literal and token', binding.interpolate('Invoice {{invoice.number}}', scope), 'Invoice INV-1001')
  check('array index', binding.interpolate('{{items[0].name}}', scope), 'Website Development')
  check('currency format', binding.interpolate('{{invoice.total | currency}}', scope), '55,000.00')
  check('integer format', binding.interpolate('{{items[1].price | integer}}', scope), '5,000')
  check('missing path yields empty', binding.interpolate('{{customer.vatNumber}}', scope), '')
  check(
    'missing path keeps token in edit mode',
    binding.interpolate('{{customer.vatNumber}}', scope, { onMissing: 'token' }),
    '{{customer.vatNumber}}',
  )
  check('raw value stays numeric', binding.resolveValue('{{invoice.total}}', scope), 55000)

  section('Binding — repeater scope chaining')
  const row = binding.itemScope(scope, (data.items as unknown[])[1], 1, 2)
  check('item.* resolves in row scope', binding.interpolate('{{item.name}}', row), 'Hosting')
  check('row index is 1-based via rowNumber', binding.resolvePath(row, 'rowNumber'), 2)
  check('root still reachable from a row', binding.interpolate('{{company.name}}', row), 'Acme Technologies')

  section('Binding — variable tree')
  const tree = binding.buildVariableTree(data)
  const items = tree.find((n: any) => n.path === 'items')
  check('items is an array root', items?.isArrayRoot, true)
  check('array children use row-scoped tokens', items?.children?.[0]?.token, '{{item.name}}')
  check('array children display bracket paths', items?.children?.[0]?.path, 'items[].name')
  check('array sources discovered', binding.arraySources(data), ['items'])

  section('Conditions')
  check('false when zero', conditions.evaluateCondition('invoice.discount > 0', scope), false)
  check('true when greater', conditions.evaluateCondition('invoice.total > 1000', scope), true)
  check('exists', conditions.evaluateCondition('customer.email exists', scope), true)
  check('empty on populated array', conditions.evaluateCondition('items empty', scope), false)
  check('string equality is loose', conditions.evaluateCondition('customer.name == "john doe"', scope), true)
  check('negation', conditions.evaluateCondition('!invoice.discount', scope), true)
  check('all must pass', conditions.evaluateConditions(['invoice.total > 1000', 'invoice.discount > 0'], scope), false)
  check('no conditions renders', conditions.evaluateConditions(undefined, scope), true)

  section('Versioning')
  let template = catalog.createBlankTemplate({
    id: 'my-invoice',
    name: 'My Invoice',
    category: 'invoice',
    description: '',
    size: 'A4',
    orientation: 'portrait',
  })
  check('starts at v1', template.version, 1)
  check('v1 recorded in history', template.versions.length, 1)

  template = { ...template, elements: [factory.createElement('heading', { x: 10, y: 10 })] }
  const v2 = versioning.createVersion(template, 'Added heading')
  check('version advances', v2.version, 2)
  const pinned = versioning.templateAtVersion(v2, 1)
  check('v1 snapshot has no elements', pinned?.elements.length, 0)
  check('v2 still has its element', v2.elements.length, 1)

  const restored = versioning.restoreVersion(v2, 1)
  check('restore appends rather than rewinds', restored?.version, 3)
  check('restore brings back old design', restored?.elements.length, 0)
  check('history is append-only', restored?.versions.length, 3)

  section('Handles')
  check('plain handle', versioning.parseHandle('invoice-modern'), { id: 'invoice-modern' })
  check('pinned handle', versioning.parseHandle('invoice-modern:v2'), { id: 'invoice-modern', version: 2 })

  section('Built-in immutability')
  const builtIn = { ...template, id: 'invoice-modern', builtIn: true }
  const copy = catalog.duplicateTemplate(builtIn, { id: 'my-copy', name: 'My Copy' })
  check('copy is user-owned', copy.builtIn, false)
  check('copy resets to v1', copy.version, 1)
  check('source untouched', builtIn.builtIn, true)

  section('Export safety')
  const file = exportService.toExportFile(v2)
  const serialised = JSON.stringify(file)
  check('format marker', file.format, 'templify.template')
  check('no versions exported', 'versions' in file.template, false)
  check('no builtIn flag exported', 'builtIn' in file.template, false)
  check('no customer data in file', serialised.includes('John Doe'), false)
  check('no company data in file', serialised.includes('Acme Technologies'), false)

  const roundTrip = exportService.parseTemplateFile(serialised, ['my-invoice'])
  check('re-import succeeds', roundTrip.ok, true)
  check('colliding id is reassigned', roundTrip.ok && roundTrip.template.id !== 'my-invoice', true)
  check('rejects non-JSON', exportService.parseTemplateFile('not json', []).ok, false)
  check('rejects foreign files', exportService.parseTemplateFile('{"format":"other"}', []).ok, false)

  section('Document resolution')
  const withTable = {
    ...template,
    elements: [
      factory.createElement('table', { x: 40, y: 200, width: 500, height: 160 }),
      { ...factory.createElement('text', { x: 40, y: 400 }), content: '{{customer.name}}' },
      {
        ...factory.createElement('text', { x: 40, y: 440 }),
        content: 'Discount applies',
        conditions: ['invoice.discount > 0'],
      },
    ],
  }

  const printed = resolver.resolveDocument(withTable, data, { mode: 'print' })
  check('failing condition dropped in print', printed.nodes.length, 2)
  check('table expanded to data rows', printed.nodes[0].table.rows.length, 2)
  check('first cell resolved', printed.nodes[0].table.rows[0].cells[0], 'Website Development')
  check('column widths normalise to 1', Math.round(printed.nodes[0].table.columns.reduce((s: number, c: any) => s + c.widthFraction, 0)), 1)
  check('text binding resolved', printed.nodes[1].text, 'John Doe')
  check('A4 portrait page width', printed.width, 794)

  const edited = resolver.resolveDocument(withTable, data, { mode: 'edit' })
  check('failing condition kept in edit', edited.nodes.length, 3)
  check('and flagged for dimming', edited.nodes[2].conditionFailed, true)

  const missing = resolver.resolveDocument(
    { ...template, elements: [{ ...factory.createElement('text'), content: '{{customer.vatNumber}}' }] },
    data,
    { mode: 'print' },
  )
  check('missing bindings reported', missing.missingBindings, ['customer.vatNumber'])

  section('Same data, different design')
  const designA = { ...template, elements: [{ ...factory.createElement('text'), content: '{{customer.name}}' }] }
  const designB = {
    ...template,
    id: 'other',
    elements: [{ ...factory.createElement('heading'), content: 'BILL TO {{customer.name}}' }],
  }
  const outA = resolver.resolveDocument(designA, data, { mode: 'print' })
  const outB = resolver.resolveDocument(designB, data, { mode: 'print' })
  check('design A output', outA.nodes[0].text, 'John Doe')
  check('design B output', outB.nodes[0].text, 'BILL TO John Doe')
} finally {
  await server.close()
}

console.log(`\n${checks - failures}/${checks} checks passed`)
if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
