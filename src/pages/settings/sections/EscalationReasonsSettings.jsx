import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * EscalationReasonsSettings — the WhatsApp conversation escalation-reason lookup
 * (dropdown for conversations.escalation_reason_id; backend EscalationReasonController
 * extends SimpleLookupController: plain name+colour CRUD, no sort_order/reorder route,
 * delete guarded 409 by conversations.escalation_reason_id). Thin wrapper mirrors
 * RejectionSettings/NationalitiesSettings — same SimpleLookupController shape.
 */
export default function EscalationReasonsSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* reorderable off: SimpleLookupController family has no /reorder route (audit 04-08) */}
      <StatusListEditor reorderable={false} title={t('escalationReasons.title')} subtitle={t('escalationReasons.subtitle')}
        endpoint="/escalation-reasons" addLabel={t('escalationReasons.add')} withColor />
    </div>
  )
}
