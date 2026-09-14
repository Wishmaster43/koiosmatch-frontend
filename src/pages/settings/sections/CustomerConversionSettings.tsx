import { useTranslation } from 'react-i18next'
import SingleLookupSettingCard from './SingleLookupSettingCard'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { useSettingKeyPick } from '../lib/useSettingKeyPick'

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
  const { statuses } = useCustomerLookups()
  const { value, loaded, save } = useSettingKeyPick(CONVERT_DEFAULT_STATUS_KEY, 'none', t('customerConversion.saveFailed'))

  return (
    <SingleLookupSettingCard
      title={t('customerConversion.title')}
      subtitle={t('customerConversion.subtitle')}
      options={(statuses ?? []).map(s => ({ value: s.value, label: s.label }))}
      value={value}
      onPick={save}
      loaded={loaded}
      noneLabel={t('customerConversion.none')}
    />
  )
}
