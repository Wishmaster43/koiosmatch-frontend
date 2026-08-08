import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * EscalationReasonsSettings — the WhatsApp conversation escalation-reason lookup
 * (dropdown for conversations.escalation_reason_id; backend EscalationReasonController
 * extends SimpleLookupController: plain name+colour CRUD, delete guarded 409 by
 * conversations.escalation_reason_id). Thin wrapper mirrors RejectionSettings/
 * NationalitiesSettings — same SimpleLookupController shape.
 *
 * REASON-REORDER-1 (backend landed 04-08, api b649f8f0): EscalationReasonController
 * gained `sort_order` + PUT /escalation-reasons/reorder that same day — drag-reorder
 * is back on (was correctly off before that commit; LOOKUP-GAP-1(d) verification
 * 08-08 caught the stale `reorderable={false}`, a capability the backend now serves).
 */
export default function EscalationReasonsSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor title={t('escalationReasons.title')} subtitle={t('escalationReasons.subtitle')}
        endpoint="/escalation-reasons" addLabel={t('escalationReasons.add')} withColor />
    </div>
  )
}
