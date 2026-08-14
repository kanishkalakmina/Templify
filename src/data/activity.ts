/**
 * Dashboard activity feed.
 *
 * Illustrative sample content, matching the specification's example entries.
 * A real implementation would derive this from template mutations; the
 * prototype has no event log, and inventing one would be scope the brief
 * explicitly rules out.
 */

export interface ActivityEntry {
  text: string
  when: string
}

export const RECENT_ACTIVITY: ActivityEntry[] = [
  { text: 'Invoice Modern updated', when: '2 minutes ago' },
  { text: 'Quotation Corporate published', when: '1 hour ago' },
  { text: 'Certificate template created', when: 'Yesterday' },
]
