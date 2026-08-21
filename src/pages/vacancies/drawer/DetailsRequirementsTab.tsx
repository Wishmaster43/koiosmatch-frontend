import { useTranslation } from 'react-i18next'
import { row, card, controls, dash, pair, makeFieldHelpers } from './detailsFieldKit'
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
 * senioriteit, opleiding. Its OWN pencil/save/cancel (`requirements.*` from
 * the hook) — flipping it never touches Algemeen/Locatie/Voorwaarden's drafts.
 *
 * DRILLDOWN-VOLGORDE-CANON (Danny 21-08, VACATURES 4): the required-skills
 * list that used to render here moved to the Vacaturetekst tab, directly
 * under the vacancy text (RequiredSkillsSection, now wired through its own
 * useVacancySkills hook) — this card is back to just the three field rows.
 */
export default function DetailsRequirementsTab({ vacancy: v, requirements, seniorityLevels, educationLevels }: Props) {
  const { t } = useTranslation('vacancies')
  const { editing, setEditing, form, setF, save, cancel } = requirements
  const { creatable, twoNumbers } = makeFieldHelpers(form, setF, t)

  return card(t('details.groups.requirements'), <>
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
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
