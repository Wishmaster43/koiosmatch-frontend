import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

// The tenant-setting key; the BE first-application automation reads the SAME key
// (DEFAULT-STATUS-1 contract) so both conversion paths behave identically.
export const CONVERT_DEFAULT_STATUS_KEY = 'candidate_default_status_on_convert'

/** Conversion behaviour — the deployability status a fresh Kandidaat gets right
 * after Lead → Kandidaat (Danny 2026-07-13: "status blijft leeg" na conversie).
 * Only plain statuses are offered: flagged ones (blacklist / requires reason /
 * requires match / return date) need their own prompt and can't be a default. */
export function CandidateConversionSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const { statuses } = useLookups()

  // Current value (plain string setting); 'none' = leave the status empty.
  const saved = typeof settings?.[CONVERT_DEFAULT_STATUS_KEY] === 'string' ? settings[CONVERT_DEFAULT_STATUS_KEY] : 'available'
  const [value, setValue] = useState(saved)

  // Optimistic save + revert on failure (house pattern).
  const save = async (next) => {
    const prev = value
    setValue(next)
    try {
      await saveSettingsKeys({ [CONVERT_DEFAULT_STATUS_KEY]: next })
      invalidateAllSettingsCache()
    } catch {
      setValue(prev)
      notifyError(t('candidateConversion.saveFailed'))
    }
  }

  // All statuses are selectable (Danny 2026-07-13) except the two that can't be a
  // sane default: requires_match (Geplaatst needs a linked Match) and blacklist.
  // Reason/date-flagged defaults simply open the usual prompt at conversion time.
  const plainStatuses = (statuses ?? []).filter(s => !s.requires_match && !s.is_blacklist)

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('candidateConversion.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('candidateConversion.subtitle')}</div>
      {/* Searchable single-pick dropdown, like every other lookup filter (Danny 23-07). */}
      <SearchSelect closeOnToggle width={300}
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
