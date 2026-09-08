import { useTranslation } from 'react-i18next'
import SettingLookupPicker from '../components/SettingLookupPicker'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useSettingKeyPick } from '../lib/useSettingKeyPick'
import { SectionTitle } from '@/components/ui/typography'
import SettingsLoadBanner from '../components/SettingsLoadBanner'

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
function VacancyDefaultStatusEditor() {
  const { t } = useTranslation('settings')
  const { statuses } = useVacancyLookups()
  const { value, loaded, save } = useSettingKeyPick(VACANCY_DEFAULT_STATUS_KEY, 'none', t('vacancyDefaultStatus.saveFailed'))

  return (
    <div style={{ maxWidth: 560 }}>
      <SettingsLoadBanner />
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('vacancyDefaultStatus.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('vacancyDefaultStatus.subtitle')}</div>
      {/* Searchable single-pick dropdown, like every other lookup filter (Danny 23-07). */}
      <SettingLookupPicker
        options={(statuses ?? []).map(s => ({ value: s.value, label: s.label }))}
        value={value}
        onPick={save}
        disabled={!loaded}
        width={300}
        noneLabel={t('vacancyDefaultStatus.none')}
      />
    </div>
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
