import { useRef } from 'react'
import type {
  ElementStyle,
  Orientation,
  PageSize,
  ReportTemplate,
  TableColumn,
  TemplateElement,
  TextAlign,
} from '@/types/template'
import { Button } from '@/components/ui/Button'
import { CodeInput, ColorField, MiniField, Select, Textarea } from '@/components/ui/controls'
import { Segmented } from '@/components/ui/toggles'
import { Section, StaticSection } from './Section'
import { useEditorStore } from '@/state/editorStore'
import { useUiStore } from '@/state/uiStore'
import { elementLabel } from '../palette'
import { validateCondition } from '@/services/conditions'
import { readFileAsDataUrl } from '@/utils/download'
import { uid } from '@/utils/id'
import { DOC_FONT, DOC_MONO, DOC_SERIF } from '@/render/styles'

const TEXTUAL = new Set(['text', 'heading', 'richText', 'badge', 'header', 'footer', 'signature'])
const TYPOGRAPHIC = new Set([
  'text',
  'heading',
  'richText',
  'badge',
  'header',
  'footer',
  'signature',
  'table',
  'dataGrid',
  'keyValue',
  'kpi',
  'list',
  'date',
  'pageNumber',
])

const SWATCHES = ['#0F172A', '#2F6FED', '#0F766E', '#9F1239', '#94A3B8']

export function PropertiesPanel({
  template,
  arraySources,
  onInsertVariable,
}: {
  template: ReportTemplate
  arraySources: string[]
  onInsertVariable: () => void
}) {
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const patchElement = useEditorStore((s) => s.patchElement)
  const patchStyle = useEditorStore((s) => s.patchStyle)
  const updatePage = useEditorStore((s) => s.updatePage)
  const setContentCaret = useEditorStore((s) => s.setContentCaret)
  const toast = useUiStore((s) => s.toast)
  const fileInput = useRef<HTMLInputElement>(null)

  const element =
    selectedIds.length === 1
      ? findDeep(template.elements, selectedIds[0])
      : undefined

  const header = (
    <div className="flex flex-none items-center gap-2 border-b border-line px-[13px] py-[11px]">
      <div className="text-[11.5px] font-semibold">
        {selectedIds.length > 1
          ? `${selectedIds.length} selected`
          : element
            ? elementLabel(element.type)
            : 'Properties'}
      </div>
      <div className="ml-auto truncate font-mono text-[10px] text-faint">{element?.id ?? ''}</div>
    </div>
  )

  if (!element) {
    return (
      <aside className="flex w-[286px] flex-none flex-col border-l border-line bg-panel">
        {header}
        <div className="flex-1 overflow-auto">
          <div className="px-[18px] py-7 text-center">
            <div className="text-[12px] text-muted">
              {selectedIds.length > 1 ? 'Multiple elements selected' : 'Nothing selected'}
            </div>
            <div className="mt-[7px] text-[11.5px] leading-relaxed text-faint">
              {selectedIds.length > 1
                ? 'Use the floating toolbar to align, group or delete them.'
                : 'Click an element on the page, or drag a component from the left panel.'}
            </div>
          </div>

          <StaticSection title="PAGE">
            <div className="flex gap-[7px]">
              <Select
                value={template.page.size}
                onChange={(e) => updatePage({ size: e.target.value as PageSize })}
                className="h-[29px] flex-1 text-[11.5px]"
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="LETTER">Letter</option>
              </Select>
              <Select
                value={template.page.orientation}
                onChange={(e) => updatePage({ orientation: e.target.value as Orientation })}
                className="h-[29px] flex-1 text-[11.5px]"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </Select>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-[9px]">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <MiniField
                  key={side}
                  label={side.charAt(0).toUpperCase()}
                  value={String(template.page.margins[side])}
                  onCommit={(raw) => {
                    const value = Number(raw)
                    if (Number.isFinite(value)) {
                      updatePage({ margins: { ...template.page.margins, [side]: Math.round(value) } })
                    }
                  }}
                />
              ))}
            </div>
            <div className="mt-2 text-[10.5px] leading-relaxed text-faint">
              Margins are guides for layout — elements are positioned freely.
            </div>
          </StaticSection>
        </div>
      </aside>
    )
  }

  const style = element.style
  const setStyle = (patch: Partial<ElementStyle>) => patchStyle(element.id, patch)
  const setProps = (patch: Partial<NonNullable<TemplateElement['props']>>) =>
    patchElement(element.id, { props: { ...element.props, ...patch } })

  const condition = element.conditions?.[0] ?? ''
  const conditionCheck = condition ? validateCondition(condition) : null

  const logo = element.props?.logo
  const image = element.props?.image
  const media = element.type === 'logo' ? logo : element.type === 'image' ? image : undefined
  const table = element.props?.table

  return (
    <aside className="flex w-[286px] flex-none flex-col border-l border-line bg-panel">
      {header}

      <div className="flex-1 overflow-auto">
        <Section title="LAYOUT">
          <div className="grid grid-cols-2 gap-[9px]">
            {([
              ['X', 'x'],
              ['Y', 'y'],
              ['W', 'width'],
              ['H', 'height'],
            ] as const).map(([label, key]) => (
              <MiniField
                key={key}
                label={label}
                value={String(element[key])}
                onCommit={(raw) => {
                  const value = Number(raw)
                  if (Number.isFinite(value)) patchElement(element.id, { [key]: Math.round(value) })
                }}
              />
            ))}
          </div>
        </Section>

        {TEXTUAL.has(element.type) ? (
          <StaticSection title="CONTENT">
            <Textarea
              rows={3}
              value={element.content ?? ''}
              onChange={(e) => {
                setContentCaret(e.target.selectionStart)
                patchElement(element.id, { content: e.target.value })
              }}
              // Remember where the caret was: clicking "Insert Variable" blurs
              // this field, and the token should land there rather than at the end.
              onSelect={(e) => setContentCaret(e.currentTarget.selectionStart)}
              onKeyUp={(e) => setContentCaret(e.currentTarget.selectionStart)}
              onClick={(e) => setContentCaret(e.currentTarget.selectionStart)}
            />
            <Button variant="soft" className="mt-2 h-[29px] w-full" onClick={onInsertVariable}>
              Insert Variable
            </Button>
          </StaticSection>
        ) : null}

        {TYPOGRAPHIC.has(element.type) ? (
          <Section title="TYPOGRAPHY">
            <Select
              value={style.fontFamily ?? DOC_FONT}
              onChange={(e) => setStyle({ fontFamily: e.target.value })}
              className="h-[29px] w-full text-[11.5px]"
            >
              <option value={DOC_FONT}>IBM Plex Sans</option>
              <option value={DOC_SERIF}>Source Serif 4</option>
              <option value={DOC_MONO}>IBM Plex Mono</option>
            </Select>

            <div className="mt-[9px] grid grid-cols-2 gap-[9px]">
              <MiniField
                label="Sz"
                value={String(style.fontSize ?? '')}
                onCommit={(raw) => setStyle({ fontSize: numberOrUndefined(raw) })}
              />
              <MiniField
                label="Wt"
                value={String(style.fontWeight ?? '')}
                onCommit={(raw) => setStyle({ fontWeight: numberOrUndefined(raw) })}
              />
              <MiniField
                label="LH"
                value={String(style.lineHeight ?? '')}
                onCommit={(raw) => setStyle({ lineHeight: numberOrUndefined(raw) })}
              />
              <MiniField
                label="LS"
                value={String(style.letterSpacing ?? '')}
                onCommit={(raw) => setStyle({ letterSpacing: numberOrUndefined(raw) })}
              />
            </div>

            <div className="mt-[9px]">
              <Segmented<TextAlign>
                value={style.textAlign ?? 'left'}
                onChange={(textAlign) => setStyle({ textAlign })}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
              />
            </div>
          </Section>
        ) : null}

        <Section title="APPEARANCE" defaultOpen={false}>
          <div className="flex flex-col gap-[9px]">
            <ColorField
              label="Text color"
              value={style.color ?? ''}
              onChange={(color) => setStyle({ color })}
            />
            <ColorField
              label="Background"
              value={style.background ?? ''}
              onChange={(background) => setStyle({ background })}
            />
            <ColorField
              label="Border color"
              value={style.borderColor ?? ''}
              onChange={(borderColor) =>
                setStyle({ borderColor, borderStyle: style.borderStyle ?? 'solid' })
              }
            />
            <div className="grid grid-cols-3 gap-[9px]">
              <MiniField
                label="Bw"
                value={String(style.borderWidth ?? '')}
                onCommit={(raw) => setStyle({ borderWidth: numberOrUndefined(raw) })}
              />
              <MiniField
                label="R"
                value={String(style.borderRadius ?? '')}
                onCommit={(raw) => setStyle({ borderRadius: numberOrUndefined(raw) })}
              />
              <MiniField
                label="Op"
                value={String(style.opacity ?? '')}
                onCommit={(raw) => setStyle({ opacity: numberOrUndefined(raw) })}
              />
            </div>

            <div className="flex gap-[5px]">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  title={swatch}
                  onClick={() => setStyle({ color: swatch })}
                  className="h-[22px] w-[22px] cursor-pointer rounded-[6px] border border-line"
                  style={{ background: swatch }}
                />
              ))}
            </div>
          </div>
        </Section>

        {media ? (
          <StaticSection title={element.type === 'logo' ? 'LOGO SOURCE' : 'IMAGE SOURCE'}>
            <Segmented
              value={media.source}
              onChange={(source) =>
                element.type === 'logo'
                  ? setProps({ logo: { ...logo!, source } })
                  : setProps({ image: { ...image!, source } })
              }
              options={[
                { value: 'upload', label: 'Upload' },
                { value: 'url', label: 'URL' },
                { value: 'variable', label: 'Variable' },
              ]}
            />

            <CodeInput
              className="mt-[9px]"
              placeholder={media.source === 'url' ? 'https://…/logo.png' : '{{company.logo}}'}
              value={
                media.source === 'variable'
                  ? (media.variable ?? '')
                  : media.source === 'url'
                    ? (media.url ?? '')
                    : media.upload
                      ? 'Uploaded image'
                      : ''
              }
              readOnly={media.source === 'upload'}
              onChange={(e) => {
                const value = e.target.value
                const key = media.source === 'variable' ? 'variable' : 'url'
                element.type === 'logo'
                  ? setProps({ logo: { ...logo!, [key]: value } })
                  : setProps({ image: { ...image!, [key]: value } })
              }}
            />

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const dataUrl = await readFileAsDataUrl(file)
                element.type === 'logo'
                  ? setProps({ logo: { ...logo!, source: 'upload', upload: dataUrl } })
                  : setProps({ image: { ...image!, source: 'upload', upload: dataUrl } })
                toast({ title: 'Logo updated' })
              }}
            />

            <div className="mt-2 flex gap-[6px]">
              <Button className="h-[29px] flex-1" onClick={() => fileInput.current?.click()}>
                Upload
              </Button>
              <Button
                className="h-[29px]"
                onClick={() =>
                  element.type === 'logo'
                    ? setProps({ logo: { ...logo!, upload: undefined, url: '' } })
                    : setProps({ image: { ...image!, upload: undefined, url: '' } })
                }
              >
                Remove
              </Button>
            </div>

            {element.type === 'logo' && logo ? (
              <div className="mt-[9px]">
                <div className="mb-[5px] text-[10.5px] text-faint">Alignment</div>
                <Segmented
                  value={logo.align}
                  onChange={(align) => setProps({ logo: { ...logo, align } })}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                />
              </div>
            ) : null}
          </StaticSection>
        ) : null}

        {table ? (
          <StaticSection title="TABLE · REPEAT DATA">
            <Select
              value={table.dataSource}
              onChange={(e) => setProps({ table: { ...table, dataSource: e.target.value } })}
              className="h-[29px] w-full font-mono text-[11.5px]"
            >
              {(arraySources.length ? arraySources : [table.dataSource || 'items']).map((source) => (
                <option key={source} value={source}>
                  {source}[]
                </option>
              ))}
            </Select>

            <div className="mt-[11px] flex flex-col gap-2">
              {table.columns.map((column, index) => (
                <div key={column.id} className="rounded-lg border border-line bg-toolbar p-2">
                  <div className="flex items-center gap-[5px]">
                    <input
                      value={column.header}
                      onChange={(e) =>
                        setProps({
                          table: { ...table, columns: replace(table.columns, index, { header: e.target.value }) },
                        })
                      }
                      className="h-[25px] min-w-0 flex-1 rounded-[6px] border border-line bg-app px-[7px] text-[11px] text-ink outline-none focus:border-accent/60"
                    />
                    <ColumnButton
                      label="↑"
                      disabled={index === 0}
                      onClick={() => setProps({ table: { ...table, columns: move(table.columns, index, -1) } })}
                    />
                    <ColumnButton
                      label="↓"
                      disabled={index === table.columns.length - 1}
                      onClick={() => setProps({ table: { ...table, columns: move(table.columns, index, 1) } })}
                    />
                    <ColumnButton
                      label="×"
                      danger
                      onClick={() =>
                        setProps({
                          table: { ...table, columns: table.columns.filter((_, i) => i !== index) },
                        })
                      }
                    />
                  </div>

                  <input
                    value={column.binding}
                    spellCheck={false}
                    onChange={(e) =>
                      setProps({
                        table: { ...table, columns: replace(table.columns, index, { binding: e.target.value }) },
                      })
                    }
                    className="mt-[6px] h-[25px] w-full rounded-[6px] border border-line bg-app px-[7px] font-mono text-[10.5px] text-accent-link outline-none focus:border-accent/60"
                  />

                  <div className="mt-[6px] flex gap-[5px]">
                    <Select
                      value={column.align}
                      onChange={(e) =>
                        setProps({
                          table: {
                            ...table,
                            columns: replace(table.columns, index, { align: e.target.value as TextAlign }),
                          },
                        })
                      }
                      className="h-[25px] flex-1 bg-app px-1 text-[10.5px]"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </Select>
                    <Select
                      value={column.format}
                      onChange={(e) =>
                        setProps({
                          table: {
                            ...table,
                            columns: replace(table.columns, index, {
                              format: e.target.value as TableColumn['format'],
                            }),
                          },
                        })
                      }
                      className="h-[25px] flex-1 bg-app px-1 text-[10.5px]"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="integer">Integer</option>
                      <option value="currency">Currency</option>
                      <option value="percent">Percent</option>
                      <option value="date">Date</option>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setProps({
                  table: {
                    ...table,
                    columns: [
                      ...table.columns,
                      {
                        id: uid('col'),
                        header: 'New column',
                        binding: '{{item.name}}',
                        width: 1,
                        align: 'left',
                        format: 'text',
                      },
                    ],
                  },
                })
                toast({ title: 'Column added' })
              }}
              className="mt-[9px] h-[29px] w-full cursor-pointer rounded-[7px] border border-dashed border-line-hover bg-raised text-[11.5px] text-ink-2 transition-colors hover:border-accent hover:text-accent-text"
            >
              + Add Column
            </button>

            <div className="mt-3 flex flex-col gap-[9px]">
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={table.zebra}
                  onChange={(e) => setProps({ table: { ...table, zebra: e.target.checked } })}
                  className="accent-accent"
                />
                Alternating row colors
              </label>
              <ColorField
                label="Header background"
                value={table.headerBackground}
                onChange={(headerBackground) => setProps({ table: { ...table, headerBackground } })}
              />
              <ColorField
                label="Header text"
                value={table.headerColor}
                onChange={(headerColor) => setProps({ table: { ...table, headerColor } })}
              />
            </div>
          </StaticSection>
        ) : null}

        <StaticSection title="DATA BINDING">
          <CodeInput
            placeholder="{{company.name}}"
            className="text-accent-link"
            value={element.dataBinding ?? ''}
            onChange={(e) => patchElement(element.id, { dataBinding: e.target.value })}
          />
          <div className="mt-2 text-[10.5px] leading-relaxed text-faint">
            Overrides Content when set. Use it for elements that render one value.
          </div>
        </StaticSection>

        <div className="px-[13px] pb-6 pt-3">
          <div className="mb-2 font-mono text-[9.5px] font-semibold tracking-[1px] text-ink">
            CONDITIONAL DISPLAY
          </div>
          <div className="mb-[6px] text-[10.5px] text-faint">Show this element when:</div>
          <CodeInput
            placeholder="invoice.discount > 0"
            value={condition}
            onChange={(e) => {
              const value = e.target.value
              patchElement(element.id, { conditions: value.trim() ? [value] : [] })
            }}
          />
          <div className="mt-[7px] text-[10.5px] text-faint">
            {!condition ? (
              'Always visible.'
            ) : conditionCheck && !conditionCheck.valid ? (
              <span className="text-danger">{conditionCheck.message}</span>
            ) : (
              'Evaluated against the applied test data.'
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */

function ColumnButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-[25px] w-[22px] flex-none cursor-pointer rounded-[6px] border border-line bg-raised text-[10px] transition-colors hover:border-line-hover disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'text-danger' : 'text-muted'
      }`}
    >
      {label}
    </button>
  )
}

function numberOrUndefined(raw: string): number | undefined {
  const value = Number(raw)
  return raw.trim() === '' || !Number.isFinite(value) ? undefined : value
}

function replace(columns: TableColumn[], index: number, patch: Partial<TableColumn>): TableColumn[] {
  return columns.map((column, i) => (i === index ? { ...column, ...patch } : column))
}

function move(columns: TableColumn[], index: number, delta: number): TableColumn[] {
  const next = [...columns]
  const target = index + delta
  if (target < 0 || target >= next.length) return columns
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function findDeep(elements: TemplateElement[], id: string): TemplateElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element
    if (element.children?.length) {
      const found = findDeep(element.children, id)
      if (found) return found
    }
  }
  return undefined
}
