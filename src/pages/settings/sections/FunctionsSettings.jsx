import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { SettingCard, SettingRow, Toggle } from '../components/SettingsKit'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useFunctions } from '@/lib/useFunctions'
import { useConfirm } from '@/hooks/useConfirm'

/**
 * FunctionsSettings — the CANDIDATE job-function list (/functions, e.g. "Verzorgende
 * IG") plus the field-mode toggle (creatable combobox ↔ strict dropdown).
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): persists through the REAL dedicated
 * `PUT /functions/free-entry` route — never the generic `/settings` blob. That blob
 * used to write an UNDERSCORED key (`functions_allow_free_entry`) that neither the
 * backend's write-time gate on `candidates.function_title` nor
 * `FreeEntryLookupController::allowFreeEntry()` (this list's own GET) ever reads —
 * both read the DOTTED `functions.allow_free_entry` Setting row, moved only by this
 * dedicated route. See useFunctions.ts's own doc comment for the full trail; mirrors
 * ApplicationSourcesSettings.jsx exactly.
 *
 * Distinct from the contact-person job-title list (ContactFunctionsSettings, `/contact-
 * functions`, FUNCTIONS-SPLIT-1, Danny 2026-07-20/22) — the title/subtitle/nav label
 * here spell out "candidate" so the two vocabularies are never confused (Danny 22-07).
 */
export default function FunctionsSettings() {
  const { t } = useTranslation('settings')
  const { allowFreeEntry, invalidate } = useFunctions()
  // Optimistic local override so the switch reflects the just-saved value
  // immediately (useCachedLookup's invalidate() only affects the NEXT mount) —
  // null means "follow the API's own current value". Reverted on a failed PUT.
  const [override, setOverride] = useState(null)
  const freeEntry = override ?? allowFreeEntry
  const [busy, setBusy] = useState(false)
  const { confirm, dialog } = useConfirm()

  // Persist the mode via the REAL dedicated route (see the doc comment above for
  // why the generic settings blob is not enough here); confirm before loosening
  // to free-text (data-quality choice). A tightening 409 (off-list values still in
  // use) surfaces the server's own worklist message instead of silently no-oping.
  const onToggle = (next) => {
    if (busy) return
    const persist = async () => {
      setBusy(true)
      setOverride(next)
      try {
        await api.put('/functions/free-entry', { allow_free_entry: next })
        invalidate()
      } catch (e) {
        setOverride(null)
        notifyError(extractApiError(e, t('statusList.saveFailed')))
      } finally {
        setBusy(false)
      }
    }
    if (next) confirm(t('functionsSettings.confirmFreeEntry'), persist)
    else persist()
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t('functionsSettings.freeEntry')} description={t('functionsSettings.freeEntryHint')}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        {/* withIcon (batch 12, P22-30): colourless lookup — the icon still renders,
            tinted with the shared FALLBACK_SWATCH grey (StatusListEditor's
            `item.color ?? FALLBACK_SWATCH`), so no colour meaning is implied. */}
        <StatusListEditor
          title={t('functionsSettings.title')}
          subtitle={t('functionsSettings.subtitle')}
          endpoint="/functions"
          addLabel={t('functionsSettings.add')}
          withColor={false}
          withIcon
        />
      </div>
      {dialog}
    </div>
  )
}
