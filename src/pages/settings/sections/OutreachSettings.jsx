/**
 * Outreach (call-list / bellijsten) lookups — tenant-managed lists behind the Outreach
 * feature. Reuse the shared StatusListEditor (name + colour + reorder + 409 in-use).
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Outreach statuses — the call-list status values. Backend /outreach-statuses (R-1). */
export function OutreachStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* R-1b live: tenant-added statuses are write-usable; the is_reached FLAG (never the
          slug) drives behaviour — a reached status stamps contacted_at on the call entry. */}
      <StatusListEditor compact withColor title={t('outreach.statusTitle')} subtitle={t('outreach.statusSubtitle')}
        endpoint="/outreach-statuses" addLabel={t('outreach.statusAdd')}
        flagField={{ key: 'is_reached', label: t('outreach.flagReached'), description: t('outreach.flagReachedDesc') }} />
    </div>
  )
}

/**
 * Outreach outcomes — the RESULT of one call attempt (OUTREACH-2), a separate
 * dimension from status (the pipeline). Same value/label/color/order shape as
 * OutreachStatus (SlugLookupController base) — no extra flags, in-use guarded
 * by outreach_targets.outcome.
 *
 * withValueSlug (LOOKUP-GAP-1(d) verification 08-08): OutreachOutcomeController
 * extends SlugLookupController, whose store() validates `value` as REQUIRED —
 * without this opt-in StatusListEditor only ever sent name/label and
 * "+ toevoegen" would 422 on every tenant (same bug class already fixed for
 * CustomerPhasesSettings/OpportunityLookupsSettings — see StatusListEditor.jsx).
 */
export function OutreachOutcomeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor withValueSlug title={t('outreach.outcomeTitle')} subtitle={t('outreach.outcomeSubtitle')}
        endpoint="/outreach-outcomes" addLabel={t('outreach.outcomeAdd')} />
    </div>
  )
}
