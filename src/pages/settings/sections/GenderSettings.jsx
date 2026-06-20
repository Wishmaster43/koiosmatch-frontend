import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Geslacht — configurable list with a colour. The colour drives the candidate
 * avatar/icon in the list + drawer. Backed by /genders. */
export default function GenderSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('genderSettings.title')}
      subtitle={t('genderSettings.subtitle')}
      endpoint="/genders"
      addLabel={t('genderSettings.add')}
      withColor
    />
  )
}
