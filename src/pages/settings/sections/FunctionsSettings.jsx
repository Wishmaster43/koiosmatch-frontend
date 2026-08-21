import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { SettingCard, SettingRow, Toggle } from '../components/SettingsKit'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useFunctions } from '@/lib/useFunctions'
import { useConfirm } from '@/hooks/useConfirm'
import FreeEntryMismatchDialog, { mismatchesFromError } from '../components/FreeEntryMismatchDialog'

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
 * FUNC-STRICT-PREFLIGHT-1 (2026-08-17): tightening (free → strict) runs a preflight —
 * `GET /functions/mismatches` (FreeEntryLookupController::computeMismatches, already
 * routed) — BEFORE the PUT, so the tenant sees WHICH existing candidate function
 * values are not on the list, not just a bare "something failed" after a blind 409.
 * Confirming offers `POST /functions/gather-missing` to add the off-list values first,
 * so the tightening PUT that follows actually passes. §3B: "Switching to strict
 * requires a preflight listing non-conforming values to fix first — never silently
 * drop data." The PUT's own 409 mismatch guard stays as the backend's last word
 * (e.g. a value added between preflight and confirm) — this only makes the common
 * case visible up front instead of discovered by trial and error.
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
  // §3B preflight (settings-ronde 21-08 punt 1): the 409 mismatches list.
  const [mismatches, setMismatches] = useState(null)
  const { confirm, dialog } = useConfirm()

  // Persist the mode via the REAL dedicated route (see the doc comment above for
  // why the generic settings blob is not enough here); confirm before loosening
  // to free-text (data-quality choice). A tightening 409 (off-list values still in
  // use) surfaces the server's own worklist message instead of silently no-oping —
  // this is the LAST-RESORT guard; the preflight below is what a tenant actually sees.
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
        // Strict-preflight 409: SHOW the non-conforming values (§3B) — a toast
        // alone made the toggle look broken (gemeten 21-08).
        const mm = mismatchesFromError(e)
        if (mm) setMismatches(mm)
        else notifyError(extractApiError(e, t('statusList.saveFailed')))
      } finally {
        setBusy(false)
      }
    }
    if (next) {
      confirm(t('functionsSettings.confirmFreeEntry'), persist)
      return
    }
    // FUNC-STRICT-PREFLIGHT-1: tightening — check what would fall off the list
    // BEFORE attempting the PUT, so the tenant sees the actual off-list values,
    // never just a generic "not allowed" after the fact.
    setBusy(true)
    api.get('/functions/mismatches')
      .then(({ data }) => {
        setBusy(false)
        const mismatches = Array.isArray(data) ? data : []
        if (mismatches.length === 0) { persist(); return }
        const values = mismatches.map(m => `${m.function ?? m.name} (${m.count})`).join(', ')
        confirm(
          t('functionsSettings.confirmStrictMismatch', { count: mismatches.length, values }),
          () => {
            // Add every off-list value to the list first, so the tightening PUT
            // that follows passes with no remaining mismatch (idempotent on the
            // backend). Never fabricated locally — these are the server's own rows.
            setBusy(true)
            api.post('/functions/gather-missing')
              .then(() => persist())
              .catch(e => { setBusy(false); notifyError(extractApiError(e, t('statusList.saveFailed'))) })
          },
          { title: t('functionsSettings.confirmStrictMismatchTitle'), confirmLabel: t('functionsSettings.gatherMissing') }
        )
      })
      // The preflight itself failing (network/permission) must never silently block
      // toggling — fall through to the PUT, whose own 409 guard still applies.
      .catch(() => { setBusy(false); persist() })
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t('functionsSettings.freeEntry')} description={t('functionsSettings.freeEntryHint')}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
        {mismatches && <FreeEntryMismatchDialog mismatches={mismatches} onClose={() => setMismatches(null)} />}
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
