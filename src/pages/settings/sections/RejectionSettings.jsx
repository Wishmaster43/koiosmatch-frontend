import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * RejectionSettings — the rejection reasons lookup (an application property). The
 * per-reason channel + message templates moved to the workflow engine: a workflow
 * triggers when an application is rejected with a reason and sends the message
 * (email / WhatsApp), directly or queued. So this section only manages the reasons.
 */
export default function RejectionSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor title={t('rejection.title')} subtitle={t('rejection.subtitle')}
      endpoint="/candidate-rejection-reasons" addLabel={t('rejection.add')} withColor />
  )
}
