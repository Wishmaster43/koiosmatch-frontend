import { SectionTitle } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import { cardStyle, inputStyle, labelStyle } from './emailStyles'

// Props: the sender identity values and their setters.
interface EmailSenderCardProps {
  fromName: string
  fromEmail: string
  onFromNameChange: (value: string) => void
  onFromEmailChange: (value: string) => void
}

// Sender name + from-address card.
export default function EmailSenderCard({ fromName, fromEmail, onFromNameChange, onFromEmailChange }: EmailSenderCardProps) {
  const { t } = useTranslation('settings')
  return (
  <div style={cardStyle}>
    <SectionTitle as="div" style={{ marginBottom: 12 }}>{t('email.senderDetails')}</SectionTitle>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label htmlFor="email-sender-name" style={labelStyle}>{t('email.senderName')}</label>
        <input id="email-sender-name" value={fromName} onChange={e => onFromNameChange(e.target.value)} placeholder={t('email.senderNamePlaceholder')} style={inputStyle} />
      </div>
      <div>
        <label htmlFor="email-from-address" style={labelStyle}>{t('email.fromAddress')}</label>
        <input id="email-from-address" type="email" value={fromEmail} onChange={e => onFromEmailChange(e.target.value)} placeholder={t('email.fromPlaceholder')} style={inputStyle} />
      </div>
    </div>
  </div>
  )
}
