/**
 * InterviewSettings (X-12) — the tenant-wide AI-interview configuration: the
 * rejection mode (Koios proposes vs. automatic), POSTed through the shared
 * /settings form path with the backend validating it against the enum. The
 * recruiter phone is a per-agent field (Danny 09-09), and the booking link
 * (feeds the AI-interview invitation) saves on its own blur through the shared BlurSaveField.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings } from '@/lib/settings/useAllSettings'
import BlurSaveField from './careerSite/BlurSaveField'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, SelectField } from '../components/SettingsKit'

// AI-interview settings editor: the rejection mode.
export default function InterviewSettings() {
  const { t } = useTranslation('settings')
  const stored = useAllSettings()
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

        {/* Booking link: saves exactly { booking_link } on blur, separate from the form's save. */}
        <BlurSaveField
          key={`booking:${typeof stored.booking_link === 'string' ? stored.booking_link : ''}`}
          settingKey="booking_link"
          stored={typeof stored.booking_link === 'string' ? stored.booking_link : ''}
          type="url"
          label={t('interview.bookingLink')}
          description={t('interview.bookingLinkHelp')}
          placeholder={t('interview.bookingLinkPlaceholder')}
          isValid={v => /^https?:\/\/\S+$/i.test(v)}
          invalidMessage={t('interview.bookingLinkInvalid')}
        />
      </SettingCardList>
    </SettingsScaffold>
  )
}
