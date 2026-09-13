/**
 * RejectionSettings — the rejection reasons lookup (an application property). The
 * per-reason channel + message templates moved to the workflow engine: a workflow
 * triggers when an application is rejected with a reason and sends the message
 * (email / WhatsApp), directly or queued. So this section only manages the reasons.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// Thin StatusListEditor wrapper for the rejection-reasons lookup (channel/message
// templates now live in the workflow engine — this only manages the reasons themselves).
export default function RejectionSettings() {
  const { t } = useTranslation('settings')
  // Drag-reorder on: candidate_rejection_reasons carries sort_order + PUT
  // /candidate-rejection-reasons/reorder (BE ea4d2ebb, CandidateRejectionReasonController
  // on ReordersLookup) — mirrors BlacklistReasonsSettings (LOOKUP-REORDER-1).
  // withIcon reverted (LOOKUP-ICONS-FE-2 fix, 13-09): CandidateRejectionReasonController
  // has no icon column/validation — stays colour-only.
  return (
    <StatusListEditor title={t('rejection.title')} subtitle={t('rejection.subtitle')}
      endpoint="/candidate-rejection-reasons" addLabel={t('rejection.add')} withColor />
  )
}
