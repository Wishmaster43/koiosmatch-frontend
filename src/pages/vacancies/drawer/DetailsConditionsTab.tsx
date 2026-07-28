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
  const { twoInputs } = makeFieldHelpers(form, setF, t)

  // Danny addendum: min/max placeholders stay literal (pre-existing, not new
  // i18n scope for this split — see hook file comment on payload parity).
  return card(t('details.groups.conditions'), <>
    {row(t('details.salary'), pair(v.salaryMin, v.salaryMax) || v.salary || dash, twoInputs('salaryMin', 'salaryMax', 'min', 'max'), editing)}
    {row(t('details.hours'), pair(v.hoursMin, v.hoursMax) || v.hours || dash, twoInputs('hoursMin', 'hoursMax', 'min', 'max'), editing)}
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
