import { useTranslation } from 'react-i18next'
import SingleLookupSettingCard from './SingleLookupSettingCard'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useSettingKeyPick } from '../lib/useSettingKeyPick'

// The tenant-setting key; VacancyDefaultStatusResolver (backend) applies it on every
// status-less vacancy create (VACSTATUS-DEFAULT-1) — the FE never has to replicate
// that resolve logic itself, only offer the picker.
export const VACANCY_DEFAULT_STATUS_KEY = 'vacancy_default_status_on_create'

/**
 * Default-status behaviour — which status a freshly created vacancy gets when the
 * create request omits one. Mirrors CustomerConversionSettings' structure: an ABSENT
 * setting shows 'none' (the honest state — nothing configured yet), and every
 * configured status is offered (vacancy statuses carry no requires_match/is_blacklist
 * -style flags to filter out, unlike the candidate deployability axis).
 *
 * NOTE: VacancyDefaultStatusResolver applies this setting server-side on every
 * status-less create request (falling back to the vacancy_statuses row flagged
 * `is_default` when the setting is absent/stale) — so the vacancy create modal
 * needs NO change for this to take effect.
 *
 * Unlike candidate/customer statuses (slug-based `value`), vacancy_statuses has no
 * stable slug column, so the setting stores the status's own id (uuid) —
 * VacancyLookupsContext already normalises each status's `value` to that id (no
 * `value` column exists on this lookup), so this component reads/writes the same id.
 */
// DRY: this component's shape (useSettingKeyPick + SingleLookupSettingCard call)
// reads as a near-clone of CustomerConversionSettings (jscpd weak-mode match) —
// that is the intended shape of a "one thin config file per single-lookup
// setting" screen (mirrors the §0.11 workflow-module pattern): the shared
// behaviour already lives in SingleLookupSettingCard/useSettingKeyPick, and each
// file only supplies its own tenant-setting key, lookup source and i18n keys.
// Merging these two into one generic wrapper would just re-introduce a second
// config layer for no behavioural gain.
function VacancyDefaultStatusEditor() {
  const { t } = useTranslation('settings')
  const { statuses } = useVacancyLookups()
  const { value, loaded, save } = useSettingKeyPick(VACANCY_DEFAULT_STATUS_KEY, 'none', t('vacancyDefaultStatus.saveFailed'))

  return (
    <SingleLookupSettingCard
      title={t('vacancyDefaultStatus.title')}
      subtitle={t('vacancyDefaultStatus.subtitle')}
      options={(statuses ?? []).map(s => ({ value: s.value, label: s.label }))}
      value={value}
      onPick={save}
      loaded={loaded}
      noneLabel={t('vacancyDefaultStatus.none')}
    />
  )
}

// Wraps the editor in its OWN VacancyLookupsProvider (mirrors VacancyCandidateTabSettings) —
// Settings has no page-level vacancy-lookups context of its own.
export default function VacancyDefaultStatusSettings() {
  return (
    <VacancyLookupsProvider>
      <VacancyDefaultStatusEditor />
    </VacancyLookupsProvider>
  )
}
