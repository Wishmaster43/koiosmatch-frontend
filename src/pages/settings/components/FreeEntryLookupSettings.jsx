/**
 * FreeEntryLookupSettings — the shared free-entry-lookup screen shape behind
 * FunctionsSettings / ApplicationSourcesSettings / ContactFunctionsSettings: a
 * free-entry Toggle persisted through a lookup's OWN dedicated `PUT
 * {endpoint}/free-entry` route (never the generic `/settings` blob — see each
 * caller's own doc comment for the underscored-vs-dotted-key history that made
 * that a fake affordance), plus the StatusListEditor for the lookup's values.
 *
 * A tightening 409 (off-list values still recorded) always shows the §3B
 * FreeEntryMismatchDialog instead of a bare toast. `strictPreflight` opts into
 * FunctionsSettings' extra step (FUNC-STRICT-PREFLIGHT-1): a proactive
 * `GET {endpoint}/mismatches` BEFORE the PUT, so the tenant sees the
 * non-conforming values up front instead of only after a 409 — the other two
 * lookups rely on the 409 alone.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from '../sections/StatusListEditor'
import { SettingCard, SettingRow, Toggle } from './SettingsKit'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import FreeEntryMismatchDialog, { mismatchesFromError } from './FreeEntryMismatchDialog'

// The shared free-entry toggle + lookup list screen; see the module doc above for the strictPreflight/dedicated-route reasoning.
export default function FreeEntryLookupSettings({ useLookup, endpoint, i18nPrefix, strictPreflight = false, statusListEditorProps = {} }) {
  const { t } = useTranslation('settings')
  const { allowFreeEntry, invalidate } = useLookup()
  // Optimistic local override so the switch reflects the just-saved value
  // immediately (useCachedLookup's invalidate() only affects the NEXT mount) —
  // null means "follow the API's own current value". Reverted on a failed PUT.
  const [override, setOverride] = useState(null)
  const freeEntry = override ?? allowFreeEntry
  const [busy, setBusy] = useState(false)
  // §3B preflight (settings-ronde 21-08 punt 1): the 409 mismatches list.
  const [mismatches, setMismatches] = useState(null)
  const { confirm, dialog } = useConfirm()

  // Persist the mode via the REAL dedicated route (see the module doc above for
  // why the generic settings blob is not enough here); confirm before loosening
  // to free-text (data-quality choice). A tightening 409 (off-list values still in
  // use) surfaces the server's own worklist message instead of silently no-oping —
  // the LAST-RESORT guard; strictPreflight below is what a tenant actually sees first.
  const onToggle = (next) => {
    if (busy) return
    // Actually persist the toggle; a strict-tightening 409 is the last-resort
    // guard here, since strictPreflight (when enabled) is what a tenant sees first.
    const persist = async () => {
      setBusy(true)
      setOverride(next)
      try {
        await api.put(`${endpoint}/free-entry`, { allow_free_entry: next })
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
      confirm(t(`${i18nPrefix}.confirmFreeEntry`), persist)
      return
    }
    if (!strictPreflight) { persist(); return }
    // FUNC-STRICT-PREFLIGHT-1: tightening — check what would fall off the list
    // BEFORE attempting the PUT, so the tenant sees the actual off-list values,
    // never just a generic "not allowed" after the fact.
    setBusy(true)
    api.get(`${endpoint}/mismatches`)
      .then(({ data }) => {
        setBusy(false)
        const mismatches = Array.isArray(data) ? data : []
        if (mismatches.length === 0) { persist(); return }
        const values = mismatches.map(m => `${m.function ?? m.name} (${m.count})`).join(', ')
        confirm(
          t(`${i18nPrefix}.confirmStrictMismatch`, { count: mismatches.length, values }),
          () => {
            // Add every off-list value to the list first, so the tightening PUT
            // that follows passes with no remaining mismatch (idempotent on the
            // backend). Never fabricated locally — these are the server's own rows.
            setBusy(true)
            api.post(`${endpoint}/gather-missing`)
              .then(() => persist())
              .catch(e => { setBusy(false); notifyError(extractApiError(e, t('statusList.saveFailed'))) })
          },
          { title: t(`${i18nPrefix}.confirmStrictMismatchTitle`), confirmLabel: t(`${i18nPrefix}.gatherMissing`) }
        )
      })
      // The preflight itself failing (network/permission) must never silently block
      // toggling — fall through to the PUT, whose own 409 guard still applies.
      .catch(() => { setBusy(false); persist() })
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t(`${i18nPrefix}.freeEntry`)} description={t(`${i18nPrefix}.freeEntryHint`)}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
        {mismatches && <FreeEntryMismatchDialog mismatches={mismatches} onClose={() => setMismatches(null)} />}
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        <StatusListEditor
          title={t(`${i18nPrefix}.title`)}
          subtitle={t(`${i18nPrefix}.subtitle`)}
          endpoint={endpoint}
          addLabel={t(`${i18nPrefix}.add`)}
          withColor={false}
          {...statusListEditorProps}
        />
      </div>
      {dialog}
    </div>
  )
}
