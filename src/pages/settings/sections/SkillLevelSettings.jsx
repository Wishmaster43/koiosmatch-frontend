import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Skill levels (SKILL-LVL-1) — tenant lookup for the candidate skill "niveau"
 * dropdown (mirrors language levels). Name-only, reorderable, in-use-protected.
 */
export function SkillLevelSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor={false}
        title={t('skillLevels.title')} subtitle={t('skillLevels.subtitle')}
        endpoint="/skill-levels" addLabel={t('skillLevels.add')} />
    </div>
  )
}
