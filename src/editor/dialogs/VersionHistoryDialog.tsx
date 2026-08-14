import type { ReportTemplate } from '@/types/template'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { versionsDescending } from '@/services/versioning'
import { relativeTime } from '@/utils/format'

/**
 * Version history is append-only: restoring an older design appends it as a new
 * version rather than rewinding, so nothing is ever lost and a restore is
 * itself reversible (architecture D-2).
 */
export function VersionHistoryDialog({
  open,
  onClose,
  template,
  onCreateVersion,
  onRestore,
  onPreviewVersion,
}: {
  open: boolean
  onClose: () => void
  template: ReportTemplate
  onCreateVersion: () => void
  onRestore: (version: number) => void
  onPreviewVersion: (version: number) => void
}) {
  const versions = versionsDescending(template)

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={440}
      title="Version history"
      subtitle={template.name}
      bodyClassName="p-2"
      headerAside={
        <Button variant="primary" onClick={onCreateVersion}>
          Create version
        </Button>
      }
    >
      {versions.map((entry) => {
        const current = entry.version === template.version
        return (
          <div
            key={entry.version}
            className="flex items-center gap-[11px] rounded-lg px-[10px] py-[11px] transition-colors hover:bg-raised"
          >
            <span
              className={`flex-none rounded-[5px] px-[7px] py-[3px] font-mono text-[10px] font-semibold ${
                current
                  ? 'bg-[rgba(91,124,250,.16)] text-accent-text'
                  : 'bg-line text-muted'
              }`}
            >
              {`v${entry.version}`}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px]">{entry.note || `Version ${entry.version}`}</span>
              <span className="mt-[2px] block text-[10.5px] text-faint">
                {current ? 'Current · ' : ''}
                {relativeTime(entry.createdAt)}
              </span>
            </span>

            <Button size="xs" className="flex-none" onClick={() => onPreviewVersion(entry.version)}>
              Preview
            </Button>
            <Button
              size="xs"
              className="flex-none"
              disabled={current}
              onClick={() => onRestore(entry.version)}
            >
              Restore
            </Button>
          </div>
        )
      })}

      {!versions.length ? (
        <div className="px-4 py-[30px] text-center text-[11.5px] text-faint">
          No previous versions yet.
        </div>
      ) : null}

      <div className="border-t border-line px-[10px] pb-1 pt-3 text-[10.5px] leading-relaxed text-faint">
        Applications can pin a version —{' '}
        <span className="font-mono text-accent-link">
          {`${template.id}:v${template.version}`}
        </span>{' '}
        — so a design change never breaks a live integration.
      </div>
    </Modal>
  )
}
