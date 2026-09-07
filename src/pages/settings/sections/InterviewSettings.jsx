/**
 * InterviewSettings (X-12) — the tenant-wide AI-interview configuration:
 * rejection mode (Koios proposes vs. automatic), booking link (where candidates
 * schedule interviews), and recruiter phone (fallback contact for interview
 * invitations). All three keys POST through the same /settings form path, with
 * the backend validating interview_rejection_mode against the enum, booking_link
 * as a URL, and recruiter_phone as E.164 format (normalized at write time by
 * PhoneNumber::toE164).
 */
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, TextField, SelectField } from '../components/SettingsKit'

// AI-interview settings editor: rejection mode, booking link, and recruiter phone.
export default function InterviewSettings() {
  const { t } = useTranslation('settings')
  // Tenant defaults: proposal mode (default), empty booking link and recruiter phone.
  const form = useSettingsForm({
    interview_rejection_mode: 'proposal',
    booking_link: '',
    recruiter_phone: '',
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

        {/* Booking link: URL where candidates schedule their interview (sent by Koios). */}
        <SettingRow label={t('interview.bookingLink.label')} description={t('interview.bookingLink.description')}>
          <TextField
            value={form.values.booking_link}
            onChange={v => form.set('booking_link', v)}
            placeholder={t('interview.bookingLink.placeholder')}
            width={280}
          />
        </SettingRow>

        {/* Recruiter phone: fallback E.164 number Koios sends when there is no per-user owner phone. */}
        <SettingRow label={t('interview.recruiterPhone.label')} description={t('interview.recruiterPhone.description')}>
          <TextField
            value={form.values.recruiter_phone}
            onChange={v => form.set('recruiter_phone', v)}
            placeholder={t('interview.recruiterPhone.placeholder')}
            width={280}
          />
        </SettingRow>
      </SettingCardList>
    </SettingsScaffold>
  )
}
