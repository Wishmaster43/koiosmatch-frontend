/**
 * InterviewSettings (X-12) — the tenant-wide AI-interview configuration: the
 * rejection mode (Koios proposes vs. automatic), POSTed through the shared
 * /settings form path with the backend validating it against the enum. The
 * recruiter phone is a per-agent field (Danny 09-09), and the booking link left
 * this screen on Danny's row 53 (17-09: "kan weg") — the tenant key stays on the
 * backend under career_site/personal (measured: no reader), so nothing else changes.
 */
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, SelectField } from '../components/SettingsKit'

// AI-interview settings editor: the rejection mode.
export default function InterviewSettings() {
  const { t } = useTranslation('settings')
  // Tenant default: proposal mode.
  const form = useSettingsForm({
    interview_rejection_mode: 'proposal',
  })

  // Rejection mode options: proposal (Koios proposes, recruiter confirms) or automatic (direct rejection).
  const rejectionModeOptions = [
    { value: 'proposal', label: t('interview.rejectionMode.options.proposal') },
    { value: 'automatic', label: t('interview.rejectionMode.options.automatic') },
  ]

  return (
    <SettingsScaffold title={t('interview.title')} subtitle={t('interview.subtitle')} maxWidth={640} form={form}>
      <SettingCardList>
        {/* Rejection mode: how DISQUALIFIED AI-interview outcomes are handled. */}
        <SettingRow label={t('interview.rejectionMode.label')} description={t('interview.rejectionMode.description')}>
          <SelectField
            value={form.values.interview_rejection_mode}
            onChange={v => form.set('interview_rejection_mode', v)}
            options={rejectionModeOptions}
            ariaLabel={t('interview.rejectionMode.label')}
          />
        </SettingRow>

      </SettingCardList>
    </SettingsScaffold>
  )
}
