import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { SettingCard, SettingRow, Toggle } from '../components/SettingsKit'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { useConfirm } from '@/hooks/useConfirm'
import FreeEntryMismatchDialog, { mismatchesFromError } from '../components/FreeEntryMismatchDialog'

/**
 * ApplicationSourcesSettings — S-SOURCE-1 GRADUATION (2026-08-14): the tenant
 * acquisition-source list (/candidate-sources, e.g. "Indeed", "LinkedIn",
 * "Referral") that feeds the application source picker (AddApplicationModal,
 * ApplicationDetailsCard — see useApplicationSources) plus the free-entry toggle
 * (creatable combobox ↔ strict dropdown). Mirrors FunctionsSettings' shared
 * FreeEntryLookupController base on the backend (CRUD, reorder, in-use 409,
 * strict-tightening mismatch guard) — but, UNLIKE FunctionsSettings/
 * ContactFunctionsSettings, the toggle here persists through the REAL dedicated
 * `PUT /candidate-sources/free-entry` route instead of the generic `/settings`
 * blob. Measured: that generic blob writes an UNDERSCORED key
 * (`..._allow_free_entry`) that neither `ValidCandidateSource` (the write-time
 * guard on `candidates.source`/`applications.source`) nor
 * `FreeEntryLookupController::allowFreeEntry()` (this list's own GET) ever reads —
 * both read the DOTTED `candidate_sources.allow_free_entry` Setting row, moved
 * only by this dedicated route. Persisting through the generic blob would look
 * flipped in this app while the server kept 422ing a newly typed source — see
 * useApplicationSources.ts's own doc comment for the full trail. The dedicated
 * route also carries the backend's strict-tightening mismatch guard (409 while an
 * off-list value is still recorded), so a failed toggle-off is a real, surfaced
 * refusal here, never a silent no-op.
 *
 * Named after the endpoint's ACTUAL backend model (CandidateSource) shares one
 * list with the candidate intake's own source field — but this settings screen
 * lives in the Applications group because the application create/edit surfaces
 * are its only frontend consumers today (the candidate intake has no source
 * field of its own yet).
 */
export default function ApplicationSourcesSettings() {
  const { t } = useTranslation('settings')
  const { allowFreeEntry, invalidate } = useApplicationSources()
  // Optimistic local override so the switch reflects the just-saved value
  // immediately (useCachedLookup's invalidate() only affects the NEXT mount) —
  // null means "follow the API's own current value". Reverted on a failed PUT.
  const [override, setOverride] = useState(null)
  const freeEntry = override ?? allowFreeEntry
  const [busy, setBusy] = useState(false)
  // §3B preflight (settings-ronde 21-08 punt 1): the 409 mismatches list.
  const [mismatches, setMismatches] = useState(null)
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
        await api.put('/candidate-sources/free-entry', { allow_free_entry: next })
        invalidate()
      } catch (e) {
        setOverride(null)
        // Strict-preflight 409: SHOW the non-conforming values (§3B) — a toast
        // alone made the toggle look broken (gemeten 21-08).
        const mm = mismatchesFromError(e)
        if (mm) setMismatches(mm)
        else notifyError(extractApiError(e, t('statusList.saveFailed')))
      } finally {
        setBusy(false)
      }
    }
    if (next) confirm(t('applicationSourcesSettings.confirmFreeEntry'), persist)
    else persist()
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t('applicationSourcesSettings.freeEntry')} description={t('applicationSourcesSettings.freeEntryHint')}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
        {mismatches && <FreeEntryMismatchDialog mismatches={mismatches} onClose={() => setMismatches(null)} />}
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        <StatusListEditor
          title={t('applicationSourcesSettings.title')}
          subtitle={t('applicationSourcesSettings.subtitle')}
          endpoint="/candidate-sources"
          addLabel={t('applicationSourcesSettings.add')}
          withColor={false}
        />
      </div>
      {dialog}
    </div>
  )
}
