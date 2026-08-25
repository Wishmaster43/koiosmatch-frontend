/** Driving licence categories — configurable list used by the candidate's
 * driving-licence preference chips. Backed by /driver-licenses. No colour:
 * it is a plain value list. */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

export default function DriverLicenseSettings() {
  const { t } = useTranslation('settings')
  return (
    // withIcon (batch 12, P22-30): colourless lookup — icon renders with the shared
    // FALLBACK_SWATCH grey tint, no colour meaning implied.
    <StatusListEditor
      title={t('driverLicenseSettings.title')}
      subtitle={t('driverLicenseSettings.subtitle')}
      endpoint="/driver-licenses"
      addLabel={t('driverLicenseSettings.add')}
      withColor={false}
      withIcon
    />
  )
}
