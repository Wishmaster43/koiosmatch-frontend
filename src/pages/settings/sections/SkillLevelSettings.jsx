import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Skill levels (SKILL-LVL-1) — tenant lookup for the candidate skill "niveau"
 * dropdown (mirrors language levels). Name-only, in-use-protected.
 */
export function SkillLevelSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* reorderable off (audit finding, 05-08, mirrors NationalitiesSettings' 04-08
          precedent): SkillLevelController only exposes GET/POST/PUT/{id}/DELETE
          (routes/api/tenant/candidate-lookups.php) — no PUT /skill-levels/reorder —
          so a drag-drop here would optimistically reorder, then 404-toast on the
          PUT and revert (§3: no dead CRUD affordance). */}
      <StatusListEditor compact withColor={false} reorderable={false}
        title={t('skillLevels.title')} subtitle={t('skillLevels.subtitle')}
        endpoint="/skill-levels" addLabel={t('skillLevels.add')} />
    </div>
  )
}
