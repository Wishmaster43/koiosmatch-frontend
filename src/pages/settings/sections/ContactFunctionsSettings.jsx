import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { SettingCard, SettingRow, Toggle } from '../components/SettingsKit'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useContactFunctions } from '@/lib/useContactFunctions'
import { useConfirm } from '@/hooks/useConfirm'
import FreeEntryMismatchDialog, { mismatchesFromError } from '../components/FreeEntryMismatchDialog'

/**
 * ContactFunctionsSettings — the contact-person job-title list (/contact-functions,
 * FUNCTIONS-SPLIT-1) + the free-entry toggle (Danny 24-07: "ook voor deze het blok
 * vrije invoer toestaan").
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): persists through the REAL dedicated
 * `PUT /contact-functions/free-entry` route — never the generic `/settings` blob.
 * That blob used to write an UNDERSCORED key (`contact_functions_allow_free_entry`)
 * that neither `CustomerContactController`'s write-time gate on
 * `customer_contacts.function` nor `FreeEntryLookupController::allowFreeEntry()`
 * (this list's own GET) ever reads — both read the DOTTED
 * `contact_functions.allow_free_entry` Setting row, moved only by this dedicated
 * route. See useContactFunctions.ts's own doc comment for the full trail; mirrors
 * ApplicationSourcesSettings.jsx / FunctionsSettings.jsx exactly.
 */
export default function ContactFunctionsSettings() {
  const { t } = useTranslation('settings')
  const { allowFreeEntry, invalidate } = useContactFunctions()
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
        await api.put('/contact-functions/free-entry', { allow_free_entry: next })
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
    if (next) confirm(t('contactFunctionsSettings.confirmFreeEntry'), persist)
    else persist()
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t('contactFunctionsSettings.freeEntry')} description={t('contactFunctionsSettings.freeEntryHint')}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
        {mismatches && <FreeEntryMismatchDialog mismatches={mismatches} onClose={() => setMismatches(null)} />}
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        <StatusListEditor
          title={t('contactFunctionsSettings.title')}
          subtitle={t('contactFunctionsSettings.subtitle')}
          endpoint="/contact-functions"
          addLabel={t('contactFunctionsSettings.add')}
          withColor={false}
          notFoundNotice={t('contactFunctionsSettings.notAvailable')}
        />
      </div>
      {dialog}
    </div>
  )
}
