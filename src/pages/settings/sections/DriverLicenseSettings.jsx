import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Driving licence categories — configurable list used by the candidate's
 * driving-licence preference chips. Backed by /driver-licenses. No colour:
 * it is a plain value list. */
export default function DriverLicenseSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('driverLicenseSettings.title')}
      subtitle={t('driverLicenseSettings.subtitle')}
      endpoint="/driver-licenses"
      addLabel={t('driverLicenseSettings.add')}
      withColor={false}
    />
  )
}
