import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

export default function RejectionSettings() {
  const { t } = useTranslation('settings')
  return <StatusListEditor title={t('rejection.title')} subtitle={t('rejection.subtitle')} endpoint="/rejection-reasons" addLabel={t('rejection.add')} withColor={false} />
}
