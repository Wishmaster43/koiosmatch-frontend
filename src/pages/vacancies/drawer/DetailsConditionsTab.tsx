import { useTranslation } from 'react-i18next'
import { row, card, controls, dash, pair, makeFieldHelpers } from './detailsFieldKit'
import type { ConditionsSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

interface Props { vacancy: VacancyDetail; conditions: ConditionsSection }

/**
 * DetailsConditionsTab — Voorwaarden sub-tab (VAC-DETAILS-SPLIT-1): salaris +
 * uren. Its OWN pencil/save/cancel (`conditions.*` from the hook) — flipping
 * it never touches Algemeen/Locatie/Eisen's drafts.
 */
export default function DetailsConditionsTab({ vacancy: v, conditions }: Props) {
  const { t } = useTranslation('vacancies')
  const { editing, setEditing, form, setF, save, cancel } = conditions
  const { twoNumbers } = makeFieldHelpers(form, setF, t)

  // Danny addendum: min/max placeholders stay literal (pre-existing, not new
  // i18n scope for this split — see hook file comment on payload parity).
  // V13: salary/hours are NUMBER fields — backend validates salary_min/max as
  // `numeric, min:0` and hours_min/max as `integer, between:0,168` (StoreVacancyRequest).
  return card(t('details.groups.conditions'), <>
    {row(t('details.salary'), pair(v.salaryMin, v.salaryMax) || v.salary || dash, twoNumbers('salaryMin', 'salaryMax', 'min', 'max', { min: 0, step: 0.01 }), editing)}
    {row(t('details.hours'), pair(v.hoursMin, v.hoursMax) || v.hours || dash, twoNumbers('hoursMin', 'hoursMax', 'min', 'max', { min: 0, max: 168, step: 1 }), editing)}
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
