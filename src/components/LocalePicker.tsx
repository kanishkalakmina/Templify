import { Select } from './ui/controls'
import { LOCALES, type LocaleCode } from '@/i18n/locales'
import { useSettingsStore } from '@/state/settingsStore'

/**
 * Switches the language the *document* renders in — not the editor chrome.
 *
 * Each option shows the language in its own script, which doubles as a font
 * check: if the endonym renders as boxes here, that script's font is missing.
 */
export function LocalePicker({ className }: { className?: string }) {
  const locale = useSettingsStore((s) => s.previewLocale)
  const setLocale = useSettingsStore((s) => s.setPreviewLocale)

  return (
    <Select
      value={locale}
      onChange={(e) => setLocale(e.target.value as LocaleCode)}
      title="Document language"
      aria-label="Document language"
      className={className}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.endonym}
        </option>
      ))}
    </Select>
  )
}
