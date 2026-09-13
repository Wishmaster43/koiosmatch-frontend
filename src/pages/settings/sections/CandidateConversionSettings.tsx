/**
 * CandidateConversionSettings — conversion behaviour: the deployability status
 * a fresh Kandidaat gets right after Lead → Kandidaat (Danny 2026-07-13,
 * translated: "status stays empty after conversion" — verbatim: "status
 * blijft leeg" na conversie). Only plain statuses are offered: flagged ones
 * (blacklist / requires reason / requires match / return date) need their own
 * prompt and can't be a default.
 */
import { useTranslation } from 'react-i18next'
import SettingLookupPicker from '../components/SettingLookupPicker'
import { useLookups } from '@/context/LookupsContext'
import { useSettingKeyPick } from '../lib/useSettingKeyPick'
import { SectionTitle } from '@/components/ui/typography'
import SettingsLoadBanner from '../components/SettingsLoadBanner'

// The tenant-setting key; the BE first-application automation reads the SAME key
// (DEFAULT-STATUS-1 contract) so both conversion paths behave identically.
export const CONVERT_DEFAULT_STATUS_KEY = 'candidate_default_status_on_convert'

// Picks the tenant's default deployability status for a fresh Lead→Kandidaat
// conversion; only plain statuses are offered (flagged ones need their own prompt).
export function CandidateConversionSettings() {
  const { t } = useTranslation('settings')
  const { statuses } = useLookups()
  const { value, loaded, save } = useSettingKeyPick(CONVERT_DEFAULT_STATUS_KEY, 'available', t('candidateConversion.saveFailed'))

  // All statuses are selectable (Danny 2026-07-13) except the two that can't be a
  // sane default: requires_match (Geplaatst needs a linked Match) and blacklist.
  // Reason/date-flagged defaults simply open the usual prompt at conversion time.
  const plainStatuses = (statuses ?? []).filter(s => !s.requires_match && !s.is_blacklist)

  return (
    <div style={{ maxWidth: 560 }}>
      <SettingsLoadBanner />
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('candidateConversion.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('candidateConversion.subtitle')}</div>
      {/* Searchable single-pick dropdown, like every other lookup filter (Danny 23-07). */}
      <SettingLookupPicker
        options={plainStatuses.map(s => ({ value: s.value, label: s.label }))}
        value={value}
        onPick={save}
        disabled={!loaded}
        width={300}
        noneLabel={t('candidateConversion.none')}
      />
    </div>
  )
}
