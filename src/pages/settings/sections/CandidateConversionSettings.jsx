/**
 * CandidateConversionSettings — conversion behaviour: the deployability status
 * a fresh Kandidaat gets right after Lead → Kandidaat (Danny 2026-07-13,
 * translated: "status stays empty after conversion" — verbatim: "status
 * blijft leeg" na conversie). Only plain statuses are offered: flagged ones
 * (blacklist / requires reason / requires match / return date) need their own
 * prompt and can't be a default.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, useSettingsLoaded, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { SectionTitle } from '@/components/ui/typography'

// The tenant-setting key; the BE first-application automation reads the SAME key
// (DEFAULT-STATUS-1 contract) so both conversion paths behave identically.
export const CONVERT_DEFAULT_STATUS_KEY = 'candidate_default_status_on_convert'

// Picks the tenant's default deployability status for a fresh Lead→Kandidaat
// conversion; only plain statuses are offered (flagged ones need their own prompt).
export function CandidateConversionSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const loaded = useSettingsLoaded()
  const { statuses } = useLookups()

  // Current value (plain string setting); 'none' = leave the status empty.
  const saved = typeof settings?.[CONVERT_DEFAULT_STATUS_KEY] === 'string' ? settings[CONVERT_DEFAULT_STATUS_KEY] : 'available'
  // STALE-INIT-1: nullable draft — see VacancyDefaultStatusSettings.jsx's own
  // comment for the full cold-cache story this replaces (`useState(saved)` froze
  // the fallback forever). `null` means "no local pick yet".
  const [draft, setDraft] = useState(null)
  const value = draft ?? saved

  // Optimistic save + revert on failure (house pattern); a no-op before the
  // blob has loaded (see the vacancy screen's own comment).
  const save = async (next) => {
    if (!loaded) return
    if (next === saved) { setDraft(next); return }
    setDraft(next)
    try {
      await saveSettingsKeys({ [CONVERT_DEFAULT_STATUS_KEY]: next })
      invalidateAllSettingsCache()
    } catch {
      setDraft(null)
      notifyError(t('candidateConversion.saveFailed'))
    }
  }

  // All statuses are selectable (Danny 2026-07-13) except the two that can't be a
  // sane default: requires_match (Geplaatst needs a linked Match) and blacklist.
  // Reason/date-flagged defaults simply open the usual prompt at conversion time.
  const plainStatuses = (statuses ?? []).filter(s => !s.requires_match && !s.is_blacklist)

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('candidateConversion.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('candidateConversion.subtitle')}</div>
      {/* Searchable single-pick dropdown, like every other lookup filter (Danny 23-07). */}
      <SearchSelect closeOnToggle width={300} disabled={!loaded}
        options={[
          { value: 'none', label: t('candidateConversion.none') },
          ...plainStatuses.map(s => ({ value: s.value, label: s.label })),
        ]}
        selected={[value]}
        onToggle={next => { if (next !== value) save(next) }}
        triggerLabel={value === 'none' ? t('candidateConversion.none') : (plainStatuses.find(s => s.value === value)?.label ?? value)} />
    </div>
  )
}
