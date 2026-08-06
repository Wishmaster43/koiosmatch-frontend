import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Education levels (KAND-NIVEAU-1) — the candidate education "niveau" lookup
 * (dropdown for candidate_educations.level_id; backend EducationLevelController
 * extends SimpleLookupController with sort_order bolted on: name+colour CRUD, a
 * real /reorder route, in-use guarded 409 by candidate_educations.level_id).
 * Thin wrapper mirrors PoolsSettings 1:1 — name+colour+drag-reorder, no extra
 * fields; distinct from the unrelated vacancy_education lookup (a separate
 * vacancy-education-levels table for the vacancy's education REQUIREMENT).
 */
export default function EducationLevelsSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor
        title={t('educationLevels.title')} subtitle={t('educationLevels.subtitle')}
        endpoint="/education-levels" addLabel={t('educationLevels.add')} />
    </div>
  )
}
