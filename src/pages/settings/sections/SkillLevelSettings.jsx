/**
 * Skill levels (SKILL-LVL-1) — tenant lookup for the candidate skill "niveau"
 * dropdown (mirrors language levels). Name-only, in-use-protected.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// See the file's top doc above; the name-only, in-use-protected skill-level lookup editor.
export function SkillLevelSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* reorderable off (audit finding, 05-08, mirrors NationalitiesSettings' 04-08
          precedent): SkillLevelController only exposes GET/POST/PUT/{id}/DELETE
          (routes/api/tenant/candidate-lookups.php) — no PUT /skill-levels/reorder —
          so a drag-drop here would optimistically reorder, then 404-toast on the
          PUT and revert (§3: no dead CRUD affordance). */}
      {/* withIcon (batch 12, P22-30): colourless lookup — icon renders with the shared
          FALLBACK_SWATCH grey tint, no colour meaning implied. */}
      <StatusListEditor compact withColor={false} withIcon reorderable={false}
        title={t('skillLevels.title')} subtitle={t('skillLevels.subtitle')}
        endpoint="/skill-levels" addLabel={t('skillLevels.add')} />
    </div>
  )
}
