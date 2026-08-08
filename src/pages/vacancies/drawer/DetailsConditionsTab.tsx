import { useTranslation } from 'react-i18next'
import { row, card, controls, dash, pair, makeFieldHelpers } from './detailsFieldKit'
import type { ConditionsSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

// Lookup option shapes this tab resolves a stored slug against — structurally
// compatible with useContractTypes().options / useCao().types (extra fields ignored).
interface LookupOpt { value: string; label: string }

interface Props {
  vacancy: VacancyDetail; conditions: ConditionsSection
  // VACANCY-CONTRACT-FIELD-1: the match-vocabulary lookups (useContractTypes/
  // useCao) — passed down from DetailsTab, same tenant lookup the +Match modal's
  // own ContractSection reads, never a hardcoded option list.
  contractTypeOptions: LookupOpt[]; caoOptions: LookupOpt[]
}

/**
 * DetailsConditionsTab — Voorwaarden sub-tab (VAC-DETAILS-SPLIT-1): salaris +
 * uren, plus (VACANCY-CONTRACT-FIELD-1) the vacancy's own SINGULAR contract
 * type + CAO — the pair the "+Match" modal prefills onto a new match (see
 * useVacancyPrefill's docblock: same lookup vocabulary as the match's own
 * `contract_type`/`cao`, `contract_types`/`collective_labour_agreements`,
 * re-verified live against the running API 2026-08-06). Its OWN pencil/save/
 * cancel (`conditions.*` from the hook) — flipping it never touches
 * Algemeen/Locatie/Eisen's drafts.
 */
export default function DetailsConditionsTab({ vacancy: v, conditions, contractTypeOptions, caoOptions }: Props) {
  const { t } = useTranslation('vacancies')
  const { editing, setEditing, form, setF, save, cancel } = conditions
  // SWEEP-NATIVE-SELECT: contract-form/CAO now use the SAME searchable
  // CreatableSelect as AddVacancyModal's match-vocabulary pickers — was a native
  // <select> here, a different control for the same lookup data (mirrors G35's
  // fix to DetailsGeneralTab's function/industry fields).
  const { twoNumbers, creatable } = makeFieldHelpers(form, setF, t)

  // Read-mode: resolve the stored slug to its tenant label (the backend sends
  // the bare slug here, unlike seniority/education which arrive pre-resolved —
  // see mapVacancy.ts's comment on this field) — falls back to the raw slug so
  // an out-of-lookup value (unconfigured tenant, free text) still shows something.
  const contractTypeLabel = contractTypeOptions.find(o => o.value === v.contractType)?.label || v.contractType
  const caoLabel = caoOptions.find(o => o.value === v.cao)?.label || v.cao

  // Danny addendum: min/max placeholders stay literal (pre-existing, not new
  // i18n scope for this split — see hook file comment on payload parity).
  // V13: salary/hours are NUMBER fields — backend validates salary_min/max as
  // `numeric, min:0` and hours_min/max as `integer, between:0,168` (StoreVacancyRequest).
  return card(t('details.groups.conditions'), <>
    {row(t('details.salary'), pair(v.salaryMin, v.salaryMax) || v.salary || dash, twoNumbers('salaryMin', 'salaryMax', 'min', 'max', { min: 0, step: 0.01 }), editing)}
    {row(t('details.hours'), pair(v.hoursMin, v.hoursMax) || v.hours || dash, twoNumbers('hoursMin', 'hoursMax', 'min', 'max', { min: 0, max: 168, step: 1 }), editing)}
    {row(t('details.matchContractType'), contractTypeLabel || dash, creatable('contractType', contractTypeOptions), editing)}
    {row(t('details.matchCao'), caoLabel || dash, creatable('cao', caoOptions), editing)}
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
