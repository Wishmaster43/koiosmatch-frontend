/**
 * InterviewSettings (X-12) — the tenant-wide AI-interview configuration. The
 * rejection mode is a read-only statement (ONIX I-005, Danny 1c = A: the AI never
 * rejects on its own, the catalogue offers only `proposal`), so nothing is posted
 * for it. The recruiter phone is a per-agent field (Danny 09-09), and the booking
 * link (feeds the AI-interview invitation) saves on its own blur through the shared BlurSaveField.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings } from '@/lib/settings/useAllSettings'
import BlurSaveField from '../components/BlurSaveField'
import { BodyText } from '@/components/ui/typography'
import { SettingsScaffold, SettingCardList, SettingRow } from '../components/SettingsKit'

// AI-interview settings: read-only rejection mode plus the booking link.
export default function InterviewSettings() {
  const { t } = useTranslation('settings')
  const stored = useAllSettings()
  return (
    <SettingsScaffold title={t('interview.title')} subtitle={t('interview.subtitle')} maxWidth={640}>
      <SettingCardList>
        {/* Rejection mode: the single behaviour, shown as plain text and never posted. */}
        <SettingRow label={t('interview.rejectionMode.label')} description={t('interview.rejectionMode.description')}>
          <BodyText>{t('interview.rejectionMode.options.proposal')}</BodyText>
        </SettingRow>

        {/* Booking link: saves exactly { booking_link } on blur, independent of any form. */}
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
