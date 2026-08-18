/**
 * Render smoke check for the UI layer.
 *
 * Loads the real screens through Vite and renders each to a string. It cannot
 * replace clicking through the app, but it does catch the failures that matter
 * most in a fresh build — bad imports, undefined access during render, missing
 * props — across every route, plus proof that built-in templates actually
 * produce document content.
 *
 * Run with:  npm run verify:render
 */

import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import * as router from 'react-router-dom'

/* Minimal browser globals. `renderToString` does not run effects, but state
 * initialisers that read `window` do execute during render. */
const noop = () => {}
Object.assign(globalThis, {
  window: {
    innerWidth: 1440,
    innerHeight: 900,
    addEventListener: noop,
    removeEventListener: noop,
    // Deliberately absent: storage falls back gracefully when unavailable.
    localStorage: undefined,
  },
})

/* react-router calls useLayoutEffect during SSR. Expected and harmless for a
 * client-only app — filtered so real failures stay visible. */
const realError = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing')) return
  realError(...args)
}

let failures = 0
let checks = 0

function check(label: string, ok: boolean, detail = '') {
  checks += 1
  if (ok) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`)
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
  const templateStore = await server.ssrLoadModule('/src/state/templateStore.ts')
  const testDataStore = await server.ssrLoadModule('/src/state/testDataStore.ts')
  const settingsStore = await server.ssrLoadModule('/src/state/settingsStore.ts')
  const editorStore = await server.ssrLoadModule('/src/state/editorStore.ts')
  const builtin = await server.ssrLoadModule('/src/templates/builtin/index.ts')
  const resolver = await server.ssrLoadModule('/src/services/resolveDocument.ts')
  const sample = await server.ssrLoadModule('/src/data/sampleData.ts')

  await templateStore.useTemplateStore.getState().hydrate()
  const templates = templateStore.useTemplateStore.getState().templates

  section('Catalogue')
  check('built-in catalogue is populated', builtin.BUILT_IN_TEMPLATES.length === 26,
    `got ${builtin.BUILT_IN_TEMPLATES.length}, expected 26`)
  check('library groups present', builtin.LIBRARY_GROUPS.length === 7,
    `got ${builtin.LIBRARY_GROUPS.length}`)
  check('workspace seeded', templates.length === 8, `got ${templates.length}`)
  check('seeded templates are user-owned', templates.every((t: any) => !t.builtIn))
  check('built-ins stay immutable', builtin.BUILT_IN_TEMPLATES.every((t: any) => t.builtIn))
  check(
    'every built-in has elements',
    builtin.BUILT_IN_TEMPLATES.every((t: any) => t.elements.length > 0),
  )
  check(
    'seeded histories match version numbers',
    templates.every((t: any) => t.versions.length === t.version),
  )

  section('Document resolution across the whole catalogue')
  let emptyRenders: string[] = []
  for (const template of builtin.BUILT_IN_TEMPLATES) {
    const doc = resolver.resolveDocument(template, sample.DEFAULT_TEST_DATA, { mode: 'print' })
    if (!doc.nodes.length) emptyRenders.push(template.id)
  }
  check('all 26 built-ins resolve to nodes', emptyRenders.length === 0, emptyRenders.join(', '))

  const invoice = builtin.BUILT_IN_TEMPLATES.find((t: any) => t.id === 'invoice-modern')
  const invoiceDoc = resolver.resolveDocument(invoice, sample.DEFAULT_TEST_DATA, { mode: 'print' })
  const texts = invoiceDoc.nodes.map((n: any) => n.text).filter(Boolean)
  check('invoice binds the customer', texts.some((t: string) => t.includes('John Doe')))
  check('invoice binds the company', texts.some((t: string) => t.includes('Acme Technologies')))
  check('invoice binds the number', texts.some((t: string) => t.includes('INV-1001')))
  const itemsTable = invoiceDoc.nodes.find((n: any) => n.table)
  check('invoice table has both line items', itemsTable?.table.rows.length === 2)
  check('money formats without trailing zeros', itemsTable?.table.rows[0].cells[2] === '50,000')
  check('no unresolved tokens in print output', !texts.some((t: string) => t.includes('{{')))

  section('Screens render')
  const screens: [string, string, string][] = [
    ['Dashboard', '/src/pages/DashboardPage.tsx', 'DashboardPage'],
    ['Templates', '/src/pages/TemplatesPage.tsx', 'TemplatesPage'],
    ['Template Library', '/src/pages/TemplateLibraryPage.tsx', 'TemplateLibraryPage'],
    ['Same Data Demo', '/src/pages/ComparePage.tsx', 'ComparePage'],
    ['API', '/src/pages/ApiPage.tsx', 'ApiPage'],
    ['Settings', '/src/pages/SettingsPage.tsx', 'SettingsPage'],
    ['Help', '/src/pages/HelpPage.tsx', 'HelpPage'],
  ]

  settingsStore.useSettingsStore.getState().hydrate()
  testDataStore.useTestDataStore.getState().hydrate()
  editorStore.useEditorStore.getState().hydrateView()

  const rendered: Record<string, string> = {}

  for (const [label, path, exportName] of screens) {
    try {
      const mod = await server.ssrLoadModule(path)
      const html = renderToString(
        React.createElement(
          router.MemoryRouter,
          { initialEntries: ['/'] },
          React.createElement(mod[exportName]),
        ),
      )
      rendered[label] = html
      check(`${label} renders`, html.length > 200, `only ${html.length} chars`)
    } catch (error) {
      check(`${label} renders`, false, String((error as Error).message).slice(0, 300))
    }
  }

  // Routes that read params need a matching route definition. These two render
  // their "not found" branch under SSR (the editor draft is opened in an effect,
  // which does not run here) — so the value is crash-smoke over the whole import
  // graph, with real content asserted on components further down.
  const paramScreens: [string, string, string, string, string][] = [
    ['Editor', '/src/pages/EditorPage.tsx', 'EditorPage', '/editor/:templateId', '/editor/invoice-modern'],
    ['Preview', '/src/pages/PreviewPage.tsx', 'PreviewPage', '/preview/:templateId', '/preview/invoice-modern'],
  ]

  for (const [label, path, exportName, routePath, entry] of paramScreens) {
    try {
      const mod = await server.ssrLoadModule(path)
      const html = renderToString(
        React.createElement(
          router.MemoryRouter,
          { initialEntries: [entry] },
          React.createElement(
            router.Routes,
            null,
            React.createElement(router.Route, {
              path: routePath,
              element: React.createElement(mod[exportName]),
            }),
          ),
        ),
      )
      rendered[label] = html
      check(`${label} renders`, html.length > 200, `only ${html.length} chars`)
    } catch (error) {
      check(`${label} renders`, false, String((error as Error).message).slice(0, 300))
    }
  }

  section('Static screen content')
  // Only content that does not come from a store can be asserted here — see the
  // note below on Zustand under SSR.
  check('API page documents the render endpoint',
    rendered.API?.includes('/api/reports/render') ?? false)
  check('settings shows the docker image', rendered.Settings?.includes('templify/report-server') ?? false)
  check('demo page states the thesis', rendered['Same Data Demo']?.includes('Same Data') ?? false)

  /*
   * The counter-print guide and its live demo. The demo's button is gated on a
   * report server being present, and SSR sees the store's empty state (see the
   * note below), so only the section and its fallback can be asserted here.
   */
  check('help page explains the render call', rendered.Help?.includes('/api/reports/render') ?? false)
  check('help page argues for HTML over PDF', rendered.Help?.includes('Ask for HTML, not PDF') ?? false)
  check('help page warns against hardcoding A4', rendered.Help?.includes('Do not hardcode A4') ?? false)
  check('help page says save the bill first', rendered.Help?.includes('Save the bill first') ?? false)
  check('help page covers the one-page cap', rendered.Help?.includes('Only the first page renders') ?? false)
  check('help page points at the runnable example',
    rendered.Help?.includes('examples/pos-counter-print') ?? false)
  check('demo page offers the counter print flow',
    rendered['Same Data Demo']?.includes('Print it at the counter') ?? false)
  check('demo page degrades without a server',
    rendered['Same Data Demo']?.includes('Needs the report server') ?? false)
  check('no React error boundaries tripped', !Object.values(rendered).some((h) => h.includes('Minified React error')))

  /*
   * Zustand v5 feeds `getInitialState` to `useSyncExternalStore` as the server
   * snapshot, so store-driven pages always render their empty state under
   * `renderToString` no matter what the store holds. That is an artifact of
   * this harness, not of the app — in the browser the live state is used.
   *
   * Anything data-dependent is therefore checked on the props-driven
   * components, where SSR sees the real thing.
   */
  section('Components render with real data')

  const card = await server.ssrLoadModule('/src/components/TemplateCard.tsx')
  const page = await server.ssrLoadModule('/src/render/DocumentPage.tsx')
  const palettePanel = await server.ssrLoadModule('/src/editor/ComponentLibraryPanel.tsx')
  const properties = await server.ssrLoadModule('/src/editor/panels/PropertiesPanel.tsx')
  const topBar = await server.ssrLoadModule('/src/editor/EditorTopBar.tsx')
  const versionDialog = await server.ssrLoadModule('/src/editor/dialogs/VersionHistoryDialog.tsx')

  const seeded = templates.find((t: any) => t.id === 'invoice-modern')

  const cardHtml = renderToString(
    React.createElement(card.TemplateCard, {
      template: seeded,
      onPreview: noop,
      onEdit: noop,
      menuItems: [],
    }),
  )
  check('template card shows the template id', cardHtml.includes('invoice-modern'))
  check('template card renders a real thumbnail', cardHtml.includes('John Doe'))
  check('template card shows the version', cardHtml.includes(`v${seeded.version}`))

  const editDoc = resolver.resolveDocument(seeded, sample.DEFAULT_TEST_DATA, { mode: 'edit' })
  const editHtml = renderToString(React.createElement(page.DocumentPage, { doc: editDoc, scale: 1 }))
  const printHtml = renderToString(
    React.createElement(page.DocumentPage, { doc: invoiceDoc, scale: 1 }),
  )
  check('edit mode shows the repeat affordance', editHtml.includes('repeat ·'))
  check('print mode hides the repeat affordance', !printHtml.includes('repeat ·'))
  check('print mode renders bound data', printHtml.includes('John Doe'))
  check('document surface is white, not app chrome', printHtml.includes('doc-surface'))

  const paletteHtml = renderToString(
    React.createElement(palettePanel.ComponentLibraryPanel, { onAdd: noop }),
  )
  check('component library renders every group', ['BASIC', 'DATA', 'VISUAL', 'UTILITIES', 'LAYOUT']
    .every((group) => paletteHtml.includes(group)))
  check('component library is searchable', paletteHtml.includes('Search components'))

  const propsHtml = renderToString(
    React.createElement(properties.PropertiesPanel, {
      template: seeded,
      arraySources: ['items'],
      onInsertVariable: noop,
    }),
  )
  check('properties panel offers page settings when idle', propsHtml.includes('PAGE'))

  const topBarHtml = renderToString(
    React.createElement(topBar.EditorTopBar, {
      template: seeded,
      dirty: true,
      canUndo: false,
      canRedo: false,
      onBack: noop,
      onUndo: noop,
      onRedo: noop,
      onOpenTestData: noop,
      onOpenVersions: noop,
      onOpenSettings: noop,
      onExport: noop,
      onPreview: noop,
      onSave: noop,
    }),
  )
  check('top bar surfaces unsaved state', topBarHtml.includes('Unsaved changes'))
  check('top bar shows the template handle', topBarHtml.includes('invoice-modern'))

  const versionsHtml = renderToString(
    React.createElement(versionDialog.VersionHistoryDialog, {
      open: true,
      onClose: noop,
      template: seeded,
      onCreateVersion: noop,
      onRestore: noop,
      onPreviewVersion: noop,
    }),
  )
  check('version history lists every version', seeded.versions.every((v: any) =>
    versionsHtml.includes(`v${v.version}`)))
  check('version history explains pinning', versionsHtml.includes(`invoice-modern:v${seeded.version}`))
} finally {
  await server.close()
}

console.log(`\n${checks - failures}/${checks} checks passed`)
if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
