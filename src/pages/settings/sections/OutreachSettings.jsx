import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Outreach (call-list / bellijsten) lookups — tenant-managed lists behind the Outreach
 * feature. Reuse the shared StatusListEditor (name + colour + reorder + 409 in-use).
 */

/** Outreach statuses — the call-list status values. Backend /outreach-statuses (R-1). */
export function OutreachStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* allowAdd off until R-1b: a brand-new status isn't write-usable yet (BE side-effects key on
          the seeded slugs) — the personalisation layer (relabel/colour/reorder) is fully supported. */}
      <StatusListEditor compact withColor allowAdd={false} title={t('outreach.statusTitle')} subtitle={t('outreach.statusSubtitle')}
        endpoint="/outreach-statuses" addLabel={t('outreach.statusAdd')} />
    </div>
  )
}
