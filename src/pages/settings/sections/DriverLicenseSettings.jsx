/** Driving licence categories — configurable list used by the candidate's
 * driving-licence preference chips. Backed by /driver-licenses. */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

export default function DriverLicenseSettings() {
  const { t } = useTranslation('settings')
  return (
    // withIcon only (LOOKUP-ICONS-FE-2 fix, 13-09): driver_licenses has an icon
    // column/fillable but NO color column — DriverLicense::$fillable lists icon,
    // not color, so a withColor PUT would be mass-assignment-dropped (§3 fake
    // affordance). icon stays on; color reverted until the backend adds the column.
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
