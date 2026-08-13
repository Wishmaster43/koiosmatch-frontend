import { useTranslation } from 'react-i18next'
import { row, card, controls, dash, pair, makeFieldHelpers } from './detailsFieldKit'
import RequiredSkillsSection from './RequiredSkillsSection'
import type { RequirementsSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

interface Level { value: string; label: string }
interface Props {
  vacancy: VacancyDetail
  requirements: RequirementsSection
  seniorityLevels: Level[]
  educationLevels: Level[]
}

/**
 * DetailsRequirementsTab — Eisen sub-tab (VAC-DETAILS-SPLIT-1): ervaring,
 * senioriteit, opleiding, plus the required-skills list. Its OWN pencil/save/
 * cancel (`requirements.*` from the hook) — flipping it never touches
 * Algemeen/Locatie/Voorwaarden's drafts.
 *
 * Skills placement: the list lives here (was a standalone block under the old
 * single-form DetailsTab) because it answers the SAME question as the rest of
 * this card — "what does the job require" — ervaring/senioriteit/opleiding are
 * requirements, and so are the required skills. Its add/edit/remove stay
 * OUTSIDE the pencil (persists immediately), but while THIS tab's pencil is
 * open the change now rides along with the Eisen Save instead of a different
 * tab's — scoping that "ride along" behaviour to the section it visually lives in.
 *
 * VACANCY-SKILLS-PARITY-1 (Danny 08-08): "Vereiste vaardigheden bij vacature
 * werken anders dan Vaardigheden bij kandidaten drill down!!" — the skills
 * list now uses the SAME add/edit/remove interaction as the candidate
 * drawer's (frozen canon) SkillsTab via RequiredSkillsSection (shared
 * AddableSection): a "+ Toevoegen" trigger reveals an inline add form, each
 * row gets its own pencil + trash. This REPLACES the old always-visible
 * text-input + "+" row, which had no per-row edit at all (remove-and-re-add
 * was the only way to rename a skill). The PATCH shape is unchanged — `skills`
 * still goes over as a plain string[] on the vacancy.
 */
export default function DetailsRequirementsTab({ vacancy: v, requirements, seniorityLevels, educationLevels }: Props) {
  const { t } = useTranslation('vacancies')
  const { editing, setEditing, form, setF, save, cancel, skills, addSkill, editSkill, removeSkill } = requirements
  const { creatable, twoNumbers } = makeFieldHelpers(form, setF, t)

  return (
    <>
      {card(t('details.groups.requirements'), <>
        {/* V12: experience-in-years is a NUMBER field — backend validates
            experience_min/max_years as `integer, between:0,60` (StoreVacancyRequest). */}
        {row(t('details.experience'), pair(v.experienceMin, v.experienceMax, t('details.years')) || dash,
          twoNumbers('experienceMin', 'experienceMax', t('details.experienceFrom'), t('details.experienceTo'), { min: 0, max: 60, step: 1 }), editing)}
        {/* G35: seniority/education now use the SAME searchable CreatableSelect as
            AddVacancyModal's RequirementsCard (was a native <select> here, a
            different control for the same lookup-driven levels). */}
        {/* VAC-CLEAR-1: both are `sometimes|nullable` server-side (StoreVacancyRequest) — optional, so both carry the clear cross. */}
        {row(t('details.seniority'), v.seniority || dash, creatable('seniority', seniorityLevels, t('details.seniority')), editing)}
        {row(t('details.education'), v.education || dash, creatable('education', educationLevels, t('details.education')), editing)}
      </>, controls(t, editing, save, cancel, () => setEditing(true)))}

      {/* VACANCY-SKILLS-PARITY-1: required skills — same list/add/edit/remove
          idiom as the candidate drawer's SkillsTab (§3B canon). */}
      <RequiredSkillsSection skills={skills} onAddSkill={addSkill} onEditSkill={editSkill} onRemoveSkill={removeSkill} />
    </>
  )
}
