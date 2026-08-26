/**
 * RequirementsCard — Functie-eisen: senioriteit + opleiding (punt 14, PARTIAL —
 * NO ervaring-min/max range: StoreVacancyRequest has no such field (measured:
 * zero hits for experience_min_years/experience_max_years in app/ + database/,
 * filed as a CMBE ticket) — adding a range picker here would be a fake
 * affordance §3 forbids) + the required-skills list.
 *
 * K6e (pop-out parity): the skills list used to be remove-only, a second,
 * simpler implementation of the same list the drawer's DetailsRequirementsTab
 * already builds via AdditionalSkillsSection (add/edit/remove, edit pencil per
 * row). Reused here as-is instead of forking a rename UI — one component, one
 * look, on both the create-modal and the drawer (§3A: extend, never duplicate).
 */
import { useTranslation } from 'react-i18next'
import { FieldRow } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import AdditionalSkillsSection from '../drawer/AdditionalSkillsSection'

interface Level { value: string; label: string }
interface Props {
  seniority: string; onSeniorityChange: (v: string) => void; seniorityLevels: Level[]
  education: string; onEducationChange: (v: string) => void; educationLevels: Level[]
  skills: string[]
  onAddSkill: (name: string) => void
  onEditSkill: (i: number, name: string) => void
  onRemoveSkill: (name: string) => void
}

// Seniority/education pickers plus the required-skills list, reusing the drawer's own AdditionalSkillsSection so create and edit share one skills UI (see file header).
export default function RequirementsCard({
  seniority, onSeniorityChange, seniorityLevels, education, onEducationChange, educationLevels,
  skills, onAddSkill, onEditSkill, onRemoveSkill,
}: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('details.groups.requirements')}</div>
      <div style={cardBox}>
        {/* VAC-CLEAR-1: both are `sometimes|nullable` server-side (StoreVacancyRequest) — optional, so both carry the clear cross. */}
        <FieldRow label={t('details.seniority')}>
          <CreatableSelect value={seniority || null} onChange={onSeniorityChange} allowCreate={false}
            clearable clearLabel={t('details.seniority')}
            placeholder={t('common:select')} options={seniorityLevels} />
        </FieldRow>
        <FieldRow label={t('details.education')}>
          <CreatableSelect value={education || null} onChange={onEducationChange} allowCreate={false}
            clearable clearLabel={t('details.education')}
            placeholder={t('common:select')} options={educationLevels} />
        </FieldRow>
        {/* K6e: required skills — the shared add/edit/remove list, mirrors
            DetailsRequirementsTab.tsx (drawer) 1:1. */}
        <AdditionalSkillsSection skills={skills} onAddSkill={onAddSkill} onEditSkill={onEditSkill} onRemoveSkill={onRemoveSkill} />
      </div>
    </div>
  )
}
