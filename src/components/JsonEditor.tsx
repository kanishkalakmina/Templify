import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * JSON editor for the Test Data panel.
 *
 * CodeMirror 6 rather than Monaco: Monaco's default Vite integration resolves
 * its workers from a CDN, which breaks the "runs with no backend" requirement,
 * and costs several megabytes for one drawer. What actually matters here is
 * linting — invalid data must be caught before Apply (architecture D-3).
 */

const THEME = EditorView.theme(
  {
    '&': { backgroundColor: '#0B0D10', color: '#C9D1DB', fontSize: '11.5px', height: '100%' },
    '.cm-content': {
      fontFamily: "'IBM Plex Mono', monospace",
      padding: '14px 0',
      lineHeight: '1.7',
    },
    '.cm-gutters': {
      backgroundColor: '#0B0D10',
      color: '#3A4250',
      border: 'none',
      fontFamily: "'IBM Plex Mono', monospace",
    },
    '.cm-activeLine': { backgroundColor: 'rgba(91,124,250,.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#68717E' },
    '.cm-cursor': { borderLeftColor: '#5B7CFA' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(91,124,250,.24)',
    },
    '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '1px dotted #E7807F' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
)

const HIGHLIGHT = HighlightStyle.define([
  { tag: tags.propertyName, color: '#8FA6FF' },
  { tag: tags.string, color: '#7EE0AE' },
  { tag: tags.number, color: '#F1C475' },
  { tag: tags.bool, color: '#C6A6FF' },
  { tag: tags.null, color: '#C6A6FF' },
  { tag: tags.punctuation, color: '#68717E' },
])

export function JsonEditor({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const extensions = useMemo(
    () => [json(), linter(jsonParseLinter()), lintGutter(), syntaxHighlighting(HIGHLIGHT), THEME],
    [],
  )

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      // `@uiw/react-codemirror` injects its own light theme unless told not to,
      // which would override the dark theme below and leave a white panel.
      theme="none"
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        autocompletion: false,
        bracketMatching: true,
        closeBrackets: true,
      }}
      className={className}
      height="100%"
    />
  )
}
