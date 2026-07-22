/**
 * RetentionSettings (AVG-RET-2, Danny 22-07 punt 8) — the tenant-wide AVG/GDPR
 * retention windows: how long a candidate's data is kept before it becomes
 * eligible for erasure, split by whether they were ever placed (longer, for the
 * statutory tax/payroll retention duty) or never placed. These two numbers are
 * what the backend uses to derive `retention_expires_at` on the candidate
 * (CandidateDetailResource), shown read-only on the Communication → Toestemmingen
 * tab — this screen is the only place that policy is edited.
 */
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, NumberField } from '../components/SettingsKit'

export default function RetentionSettings() {
  const { t } = useTranslation('settings')
  // Tenant defaults per the backend policy (AVG-RET-2): 24 months for a candidate
  // never placed, 60 months for one placed at least once.
  const form = useSettingsForm({ retention_months_never_placed: 24, retention_months_ever_placed: 60 })

  return (
    <SettingsScaffold title={t('retention.title')} subtitle={t('retention.subtitle')} maxWidth={640} form={form}>
      <SettingCardList>
        <SettingRow label={t('retention.neverPlaced.label')} description={t('retention.neverPlaced.description')}>
          <NumberField value={form.values.retention_months_never_placed}
            onChange={v => form.set('retention_months_never_placed', v)}
            min={1} max={120} unit={t('retention.unit')} />
        </SettingRow>
        <SettingRow label={t('retention.everPlaced.label')} description={t('retention.everPlaced.description')}>
          <NumberField value={form.values.retention_months_ever_placed}
            onChange={v => form.set('retention_months_ever_placed', v)}
            min={1} max={120} unit={t('retention.unit')} />
        </SettingRow>
      </SettingCardList>
    </SettingsScaffold>
  )
}
