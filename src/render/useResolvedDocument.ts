import { useMemo } from 'react'
import type { ReportTemplate } from '@/types/template'
import type { ReportData } from '@/types/data'
import { resolveDocument, type RenderMode, type ResolvedDocument } from '@/services/resolveDocument'

/**
 * Memoised document resolution.
 *
 * Keyed on the template and data identities, so it recomputes exactly when
 * either changes. Resolved values are never written back into element state —
 * that is what makes "Apply test data" update instantly with no cache to
 * invalidate (architecture AD-3).
 */
export function useResolvedDocument(
  template: ReportTemplate | null,
  data: ReportData,
  mode: RenderMode = 'edit',
): ResolvedDocument | null {
  return useMemo(
    () => (template ? resolveDocument(template, data, { mode }) : null),
    [template, data, mode],
  )
}
