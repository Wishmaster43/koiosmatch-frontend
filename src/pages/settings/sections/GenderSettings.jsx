import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * GenderSettings — Geslacht (Dutch for "gender"): configurable list with a
 * colour. The colour drives the candidate avatar/icon in the list + drawer.
 * Backed by /genders.
 */
export default function GenderSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('genderSettings.title')}
      subtitle={t('genderSettings.subtitle')}
      endpoint="/genders"
      addLabel={t('genderSettings.add')}
      // withIcon reverted (LOOKUP-ICONS-FE-2 fix, 13-09): candidate_genders has
      // value/label/color/sort_order/active only — no icon column/validation.
      withValueSlug withColor
    />
  )
}
