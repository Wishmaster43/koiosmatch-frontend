import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Availability — configurable list (Beschikbaar/Ziek/Verlof…) shown on the
 * candidate, a SEPARATE axis from the lifecycle status. Backed by /availability-options. */
export default function CandidateAvailabilitySettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('availabilitySettings.title')}
      subtitle={t('availabilitySettings.subtitle')}
      endpoint="/availability-options"
      addLabel={t('availabilitySettings.add')}
      withColor
    />
  )
}
