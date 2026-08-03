import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

// The tenant-setting key; CustomerDrawer's doConvertPhase applies it the SAME
// way useCandidateStatus.ts applies the candidate counterpart (mirrors DEFAULT-STATUS-1).
export const CONVERT_DEFAULT_STATUS_KEY = 'customer_default_status_on_convert'

/** Conversion behaviour — the status a fresh Klant gets right after Prospect →
 * Klant. Mirrors CandidateConversionSettings' structure, but unlike the candidate
 * axis an ABSENT setting shows 'none' here (Danny 2026-08-03: "converting sets no
 * status, which is what happens today") — the control always shows what is
 * actually in effect, never a guessed real status. Customer statuses carry none
 * of the candidate's requires_match/is_blacklist flags (§3B defines those only
 * for the candidate deployability axis), so every configured status is offered. */
export function CustomerConversionSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const { statuses } = useCustomerLookups()

  // Current value (plain string setting); 'none' = leave the status empty — also
  // the honest fallback when nothing is configured yet.
  const saved = typeof settings?.[CONVERT_DEFAULT_STATUS_KEY] === 'string' ? settings[CONVERT_DEFAULT_STATUS_KEY] : 'none'
  const [value, setValue] = useState(saved)

  // Optimistic save + revert on failure (house pattern, mirrors the candidate screen).
  const save = async (next) => {
    const prev = value
    setValue(next)
    try {
      await saveSettingsKeys({ [CONVERT_DEFAULT_STATUS_KEY]: next })
      invalidateAllSettingsCache()
    } catch {
      setValue(prev)
      notifyError(t('customerConversion.saveFailed'))
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('customerConversion.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('customerConversion.subtitle')}</div>
      {/* Searchable single-pick dropdown, like every other lookup filter (Danny 23-07). */}
      <SearchSelect closeOnToggle width={300}
        options={[
          { value: 'none', label: t('customerConversion.none') },
          ...(statuses ?? []).map(s => ({ value: s.value, label: s.label })),
        ]}
        selected={[value]}
        onToggle={next => { if (next !== value) save(next) }}
        triggerLabel={value === 'none' ? t('customerConversion.none') : ((statuses ?? []).find(s => s.value === value)?.label ?? value)} />
    </div>
  )
}
