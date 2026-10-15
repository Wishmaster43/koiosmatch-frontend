import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Caption } from '@/components/ui/typography'

// K-008: one calm line telling the sender the privacy notice rides along with this first message.
export default function PrivacyNoticeHint() {
  const { t } = useTranslation('candidates')
  return (
    <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      <Info size={12} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{t('conversations.privacyNoticeIncluded')}</span>
    </Caption>
  )
}
