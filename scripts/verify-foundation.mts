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
  const builtinLayouts = await server.ssrLoadModule('/src/templates/builtin/layouts.ts')
  const builtin = await server.ssrLoadModule('/src/templates/builtin/index.ts')

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

  section('Literal text in data fields')
  // Regression: a non-token string in a key/value row or table cell is content,
  // not a data path. Treating it as a path silently blanked it in print.
  const literalTemplate = {
    ...template,
    elements: [
      {
        ...factory.createElement('keyValue', { x: 40, y: 40 }),
        props: {
          keyValue: {
            rows: [
              { id: 'r1', label: 'Method', value: 'Bank Transfer', format: 'text' },
              { id: 'r2', label: 'Account', value: '**** **** 4021', format: 'text' },
              { id: 'r3', label: 'Due', value: '{{invoice.dueDate}}', format: 'date' },
              { id: 'r4', label: 'Ref', value: 'PO {{invoice.number}}', format: 'text' },
              { id: 'r5', label: 'Missing', value: '{{invoice.nope}}', format: 'text' },
            ],
            labelWidth: 50, labelColor: '#999', valueColor: '#111', labelWeight: 400,
            valueWeight: 500, rowGap: 6, divider: false, dividerColor: '#eee', valueAlign: 'right',
          },
        },
      },
      {
        ...factory.createElement('table', { x: 40, y: 200 }),
        props: {
          table: {
            ...factory.createElement('table').props.table,
            columns: [
              { id: 'c1', header: 'Item', binding: '{{item.name}}', width: 2, align: 'left', format: 'text' },
              { id: 'c2', header: 'Unit', binding: 'each', width: 1, align: 'left', format: 'text' },
              { id: 'c3', header: 'Total', binding: '{{item.total}}', width: 1, align: 'right', format: 'number' },
            ],
          },
        },
      },
    ],
  }

  const literalDoc = resolver.resolveDocument(literalTemplate, data, { mode: 'print' })
  const kvRows = literalDoc.nodes[0].keyValue
  check('literal key/value survives', kvRows[0].value, 'Bank Transfer')
  check('masked literal survives', kvRows[1].value, '**** **** 4021')
  check('bound date still formats', kvRows[2].value, 'Aug 30, 2026')
  check('mixed literal and token', kvRows[3].value, 'PO INV-1001')
  check('missing binding is blank in print', kvRows[4].value, '')
  const literalTable = literalDoc.nodes[1].table
  check('literal table cell survives', literalTable.rows[0].cells[1], 'each')
  check('bound table cell still formats', literalTable.rows[0].cells[2], '50,000')

  const literalEdit = resolver.resolveDocument(literalTemplate, data, { mode: 'edit' })
  check(
    'missing binding shows its token while editing',
    literalEdit.nodes[0].keyValue[4].value,
    '{{invoice.nope}}',
  )

  section('Report elements')
  // Regression: a KPI holds its value in props rather than `content`, so it was
  // rendering as a label with nothing under it.
  const reportTemplate = { ...template, elements: builtinLayouts.reportLayout({ accent: '#9F1239' }) }
  const reportDoc = resolver.resolveDocument(reportTemplate, data, { mode: 'print' })
  const kpis = reportDoc.nodes.filter((n: any) => n.type === 'kpi')
  check('report has three KPI cards', kpis.length, 3)
  check('KPI renders its bound value', kpis[0].text, '55,000')
  check('net KPI uses the total', kpis[2].text, '55,000')
  const chartNode = reportDoc.nodes.find((n: any) => n.type === 'chart')
  check('chart binds to the data', chartNode?.chart.points.length, 2)
  check('chart computes a max', chartNode?.chart.max, 50000)

  section('i18n — catalogue coverage')
  const locales = await server.ssrLoadModule('/src/i18n/locales.ts')
  const strings = await server.ssrLoadModule('/src/i18n/documentStrings.ts')
  const keys = strings.documentStringKeys()
  check('label keys defined', keys.length > 40, true)

  const incomplete: string[] = []
  for (const meta of locales.LOCALES) {
    const catalogue = strings.catalogueFor(meta.code)
    const missingKeys = keys.filter((k: string) => !catalogue[k])
    if (missingKeys.length) incomplete.push(`${meta.code}: ${missingKeys.slice(0, 3).join(',')}`)
  }
  check('every locale has every key', incomplete, [])
  check('all 7 locales present', locales.LOCALES.length, 7)

  // A translation that is merely the English string back is a silent gap.
  const untranslated = locales.LOCALES.filter((m: any) => m.code !== 'en').filter((m: any) => {
    const c = strings.catalogueFor(m.code)
    const en = strings.catalogueFor('en')
    return keys.every((k: string) => c[k] === en[k])
  })
  check('no locale is a copy of English', untranslated.length, 0)

  section('i18n — locale resolution')
  check('exact code', locales.resolveLocale('si').code, 'si')
  check('region tag narrows to base', locales.resolveLocale('si-LK').code, 'si')
  check('case insensitive', locales.resolveLocale('DE').code, 'de')
  check('unknown falls back to English', locales.resolveLocale('klingon').code, 'en')
  check('undefined falls back to English', locales.resolveLocale(undefined).code, 'en')
  check('sinhala carries its script', locales.resolveLocale('si').script, 'sinhala')
  check('french is latin script', locales.resolveLocale('fr').script, 'latin')

  section('i18n — label tokens')
  check('English label', binding.interpolate('{{@t.billTo}}', scope, { locale: 'en' }), 'BILL TO')
  check('Sinhala label', binding.interpolate('{{@t.billTo}}', scope, { locale: 'si' }), 'බිල් කරන්නේ')
  check('Tamil label', binding.interpolate('{{@t.subtotal}}', scope, { locale: 'ta' }), 'கூட்டுத்தொகை')
  check('German label', binding.interpolate('{{@t.total}}', scope, { locale: 'de' }), 'Gesamt')
  check('French label', binding.interpolate('{{@t.invoice}}', scope, { locale: 'fr' }), 'FACTURE')
  check(
    'label mixed with data',
    binding.interpolate('{{@t.issued}} {{invoice.number}}', scope, { locale: 'es' }),
    'Emitido el INV-1001',
  )
  check(
    'unknown label key shows itself rather than blank',
    binding.interpolate('{{@t.nopeKey}}', scope, { locale: 'en' }),
    'nopeKey',
  )

  section('i18n — locale-aware formatting')
  const money = (locale: string) =>
    binding.interpolate('{{invoice.total | number}}', scope, { locale })
  check('English groups with commas', money('en'), '55,000')
  check('German groups with dots', money('de'), '55.000')
  check('French uses a space separator', money('fr').replace(/ | /g, ' '), '55 000')
  const dateEn = binding.interpolate('{{invoice.dueDate | date}}', scope, { locale: 'en' })
  const dateDe = binding.interpolate('{{invoice.dueDate | date}}', scope, { locale: 'de' })
  check('dates differ by locale', dateEn !== dateDe, true)
  check('English date shape', dateEn, 'Aug 30, 2026')

  section('i18n — Sinhala uses Gregorian month names')
  // ICU's si-LK data returns the traditional Buddhist lunar months (නිකිණි for
  // August) at every width. Correct for a calendar, wrong on an invoice.
  const fmt = await server.ssrLoadModule('/src/utils/format.ts')
  check('August is අගෝස්තු, not නිකිණි', fmt.formatDate('2026-08-14', 'medium', 'si'), '2026 අගෝස්තු 14')
  check('January', fmt.formatDate('2026-01-14', 'medium', 'si'), '2026 ජනවාරි 14')
  check('September', fmt.formatDate('2026-09-13', 'medium', 'si'), '2026 සැප්තැම්බර් 13')
  check('December', fmt.formatDate('2026-12-01', 'medium', 'si'), '2026 දෙසැම්බර් 1')
  const lunar = ['දුරුතු', 'නවම්', 'මැදින්', 'බක්', 'වෙසක්', 'පොසොන්', 'ඇසළ', 'නිකිණි', 'බිනර', 'වප්', 'ඉල්', 'උඳුවප්']
  const leaked = [...Array(12).keys()]
    .map((m) => fmt.formatDate(`2026-${String(m + 1).padStart(2, '0')}-15`, 'medium', 'si'))
    .filter((s: string) => lunar.some((l) => s.includes(l)))
  check('no lunar month name survives in any month', leaked, [])
  check('other locales unaffected', fmt.formatDate('2026-08-14', 'medium', 'en'), 'Aug 14, 2026')
  check('Tamil keeps ICU Gregorian', fmt.formatDate('2026-08-14', 'medium', 'ta'), '14 ஆக., 2026')

  section('i18n — document rendering')
  const siInvoice = builtin.BUILT_IN_TEMPLATES.find((t: any) => t.id === 'invoice-modern')
  const invoiceSi = resolver.resolveDocument(siInvoice, sample.DEFAULT_TEST_DATA, {
    mode: 'print',
    locale: 'si',
  })
  const siText = invoiceSi.nodes.map((n: any) => n.text).filter(Boolean).join(' ')
  check('doc reports its locale', invoiceSi.locale, 'si')
  check('doc reports its script', invoiceSi.script, 'sinhala')
  check('doc reports direction', invoiceSi.direction, 'ltr')
  check('Sinhala invoice title rendered', siText.includes('ඉන්වොයිසිය'), true)
  check('Sinhala bill-to rendered', siText.includes('බිල් කරන්නේ'), true)
  check('customer data is not translated', siText.includes('John Doe'), true)
  check('label tokens never counted as missing bindings', invoiceSi.missingBindings.length, 0)
  const siTable = invoiceSi.nodes.find((n: any) => n.table)
  check('Sinhala table header', siTable?.table.columns[0].header, 'අයිතමය')
  check('literal payment method translated', invoiceSi.nodes.some((n: any) =>
    n.keyValue?.some((r: any) => r.value === 'බැංකු හුවමාරුව')), true)

  section('i18n — every template in every locale')
  const allSpecs = builtin.BUILT_IN_TEMPLATES
  const broken: string[] = []
  for (const meta of locales.LOCALES) {
    for (const template of allSpecs) {
      const d = resolver.resolveDocument(template, sample.DEFAULT_TEST_DATA, {
        mode: 'print',
        locale: meta.code,
      })
      const text = d.nodes.map((n: any) => n.text).filter(Boolean).join(' ')
      if (text.includes('{{')) broken.push(`${template.id}/${meta.code}: unresolved token`)
      if (d.missingBindings.length) broken.push(`${template.id}/${meta.code}: missing bindings`)
      if (!d.nodes.length) broken.push(`${template.id}/${meta.code}: no nodes`)
    }
  }
  // Also assert the sweep is not vacuously passing over an empty catalogue.
  check(
    'sweep covered every template and locale',
    allSpecs.length * locales.LOCALES.length,
    26 * 7,
  )
  check(
    `${allSpecs.length} templates x ${locales.LOCALES.length} locales all resolve cleanly`,
    broken.slice(0, 4),
    [],
  )

  // Sinhala and Tamil must actually differ from English on every template, or a
  // template is quietly rendering hardcoded English labels.
  const untranslatedTemplates: string[] = []
  for (const template of allSpecs) {
    const textFor = (locale: string) =>
      resolver
        .resolveDocument(template, sample.DEFAULT_TEST_DATA, { mode: 'print', locale })
        .nodes.map((n: any) => n.text)
        .filter(Boolean)
        .join(' ')
    if (textFor('en') === textFor('si')) untranslatedTemplates.push(template.id)
  }
  check('every template changes with locale', untranslatedTemplates, [])

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
