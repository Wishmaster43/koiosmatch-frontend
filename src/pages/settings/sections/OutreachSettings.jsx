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
      <StatusListEditor compact withColor title={t('outreach.statusTitle')} subtitle={t('outreach.statusSubtitle')}
        endpoint="/outreach-statuses" addLabel={t('outreach.statusAdd')} />
    </div>
  )
}
