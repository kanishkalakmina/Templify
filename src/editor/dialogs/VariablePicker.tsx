import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ReportData, VariableNode } from '@/types/data'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/controls'
import { buildVariableTree, pathExists, tokenForPath } from '@/services/binding'

interface FlatVariable {
  path: string
  token: string
  preview: string
  depth: number
  /** Leaves are insertable; objects and array roots are structure. */
  leaf: boolean
  /** Declared on the template but absent from the applied data. */
  declaredOnly?: boolean
}

/** Depth-first flattening that preserves the tree's visual indentation. */
function flatten(nodes: VariableNode[], depth = 0, out: FlatVariable[] = []): FlatVariable[] {
  for (const node of nodes) {
    const isBranch = !!node.children?.length
    out.push({
      path: node.isArrayRoot ? `${node.path}[]` : node.path,
      token: node.token,
      preview: node.preview,
      depth,
      leaf: !isBranch,
    })
    if (node.children?.length) flatten(node.children, depth + 1, out)
  }
  return out
}

const PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\[\])?(\.[A-Za-z_][A-Za-z0-9_]*(\[\])?)*$/

/**
 * The searchable data tree behind "Insert Variable".
 *
 * It is derived from the *applied test data*, so the empty state tells you to
 * apply data rather than showing nothing. "New variable" closes that loop:
 * rather than sending you to the Test Data drawer to hand-edit JSON, it seeds a
 * sample value into the payload **and** declares the path on the template, so
 * the field is both immediately renderable and part of the template's exported
 * data contract.
 */
export function VariablePicker({
  open,
  onClose,
  data,
  declared,
  onInsert,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  data: ReportData
  /** Paths declared on the template, shown even when the data lacks them. */
  declared: string[]
  onInsert: (token: string) => void
  onCreate: (path: string, sample: string) => void
}) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [path, setPath] = useState('')
  const [sample, setSample] = useState('')

  const variables = useMemo(() => {
    const discovered = flatten(buildVariableTree(data))
    const known = new Set(discovered.map((v) => v.path))
    // Declared-but-unpopulated paths still belong in the list — otherwise a
    // variable you just declared would vanish if its sample was cleared.
    const orphans: FlatVariable[] = declared
      .filter((p) => !known.has(p))
      .map((p) => ({
        path: p,
        token: tokenForPath(p),
        preview: 'no sample data',
        depth: 0,
        leaf: true,
        declaredOnly: true,
      }))
    return [...discovered, ...orphans]
  }, [data, declared])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return variables
    return variables.filter((v) => v.path.toLowerCase().includes(needle))
  }, [variables, query])

  const trimmedPath = path.trim()
  const pathError = !trimmedPath
    ? ''
    : !PATH_PATTERN.test(trimmedPath)
      ? 'Use dot paths like invoice.poNumber or items[].sku'
      : pathExists(data, trimmedPath)
        ? 'That path already exists in the data'
        : ''

  const canCreate = !!trimmedPath && !pathError

  function reset() {
    setAdding(false)
    setPath('')
    setSample('')
  }

  function submit() {
    if (!canCreate) return
    onCreate(trimmedPath, sample)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      width={420}
      title="Available Data"
      bodyClassName="p-2"
      headerAside={
        adding ? null : (
          <Button variant="soft" size="xs" onClick={() => setAdding(true)}>
            <Plus size={12} strokeWidth={2} />
            New variable
          </Button>
        )
      }
    >
      {adding ? (
        <div className="mb-2 rounded-xl border border-[rgba(91,124,250,.35)] bg-toolbar p-3">
          <div className="mb-2 flex items-center">
            <div className="font-mono text-[9.5px] font-semibold tracking-[1px] text-accent-text">
              NEW VARIABLE
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Cancel"
              className="ml-auto cursor-pointer text-faint hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>

          <Input
            autoFocus
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="invoice.poNumber"
            spellCheck={false}
            className={`h-[29px] font-mono text-[11.5px] text-accent-link ${
              pathError ? 'border-danger-line' : ''
            }`}
          />

          <Input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Sample value — e.g. PO-55913"
            className="mt-2 h-[29px] text-[11.5px]"
          />

          <div className="mt-2 text-[10.5px] leading-relaxed text-faint">
            {pathError ? (
              <span className="text-danger">{pathError}</span>
            ) : (
              <>
                Adds the sample to your test data and declares{' '}
                <span className="font-mono text-accent-link">
                  {trimmedPath ? tokenForPath(trimmedPath) : '{{…}}'}
                </span>{' '}
                on the template. Use <span className="font-mono">items[].sku</span> for a
                per-row field.
              </>
            )}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button size="xs" onClick={reset}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" disabled={!canCreate} onClick={submit}>
              Add & insert
            </Button>
          </div>
        </div>
      ) : (
        <div className="sticky top-0 z-10 -mx-2 -mt-2 mb-2 border-b border-line bg-panel px-4 pb-3 pt-1">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search variables..."
            className="h-[30px] text-[11.5px]"
          />
        </div>
      )}

      {filtered.map((variable) => (
        <button
          key={variable.path}
          type="button"
          disabled={!variable.leaf}
          onClick={() => {
            if (!variable.leaf) return
            onInsert(variable.token)
            onClose()
          }}
          style={{ paddingLeft: 9 + variable.depth * 14 }}
          className={`flex w-full items-center gap-[9px] rounded-[7px] py-[7px] pr-[9px] text-left transition-colors ${
            variable.leaf ? 'cursor-pointer hover:bg-raised' : 'cursor-default'
          }`}
        >
          <span
            className={`font-mono text-[11.5px] ${
              variable.declaredOnly
                ? 'text-muted'
                : variable.leaf
                  ? 'text-accent-link'
                  : 'font-semibold text-muted'
            }`}
          >
            {variable.path}
          </span>
          <span
            className={`ml-auto max-w-[150px] truncate font-mono text-[10.5px] ${
              variable.declaredOnly ? 'italic text-faint' : 'text-faint'
            }`}
          >
            {variable.preview}
          </span>
        </button>
      ))}

      {!filtered.length ? (
        <div className="px-[18px] py-9 text-center">
          <div className="text-[12px] text-muted">No variables</div>
          <div className="mt-[6px] text-[11.5px] text-faint">
            {variables.length
              ? `Nothing matches “${query}”.`
              : 'Apply test data to discover variables, or add one above.'}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
