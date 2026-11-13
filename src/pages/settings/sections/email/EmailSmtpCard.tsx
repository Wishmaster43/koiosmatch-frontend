import { SectionTitle } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { cardStyle, inputStyle, labelStyle } from './emailStyles'

// Props: the SMTP form values with one change handler per field, plus the password-visibility toggle.
interface EmailSmtpCardProps {
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpPassSet: boolean
  smtpSecure: string
  showPass: boolean
  onHostChange: (value: string) => void
  onPortChange: (value: string) => void
  onUserChange: (value: string) => void
  onPassChange: (value: string) => void
  onSecureChange: (value: string) => void
  onToggleShowPass: () => void
}

// SMTP credentials card (manual provider only).
export default function EmailSmtpCard({
  smtpHost, smtpPort, smtpUser, smtpPass, smtpPassSet, smtpSecure, showPass,
  onHostChange, onPortChange, onUserChange, onPassChange, onSecureChange, onToggleShowPass,
}: EmailSmtpCardProps) {
  const { t } = useTranslation('settings')
  return (
      <div style={cardStyle}>
        <SectionTitle as="div" style={{ marginBottom: 12 }}>{t('email.smtpConfig')}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 12 }}>
          <div>
            <label htmlFor="email-smtp-server" style={labelStyle}>{t('email.smtpServer')}</label>
            <input id="email-smtp-server" value={smtpHost} onChange={e => onHostChange(e.target.value)} placeholder={t('email.smtpServerPlaceholder')} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="email-smtp-port" style={labelStyle}>{t('email.port')}</label>
            <input id="email-smtp-port" type="number" value={smtpPort} onChange={e => onPortChange(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label htmlFor="email-smtp-username" style={labelStyle}>{t('email.username')}</label>
            <input id="email-smtp-username" value={smtpUser} onChange={e => onUserChange(e.target.value)} placeholder={t('email.usernamePlaceholder')} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="email-smtp-password" style={labelStyle}>
              {t('email.password')}
              {smtpPassSet && !smtpPass && (
                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success-text)', fontWeight: 400 }}>{t('email.passwordSet')}</span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input id="email-smtp-password" type={showPass ? 'text' : 'password'} value={smtpPass}
                onChange={e => onPassChange(e.target.value)}
                placeholder={smtpPassSet ? t('email.passwordKeepPlaceholder') : t('email.passwordPlaceholder')}
                style={{ ...inputStyle, paddingRight: 36 }} />
              <Button variant="ghost" iconOnly onClick={() => onToggleShowPass()}
                aria-label={showPass ? t('email.hidePassword') : t('email.showPassword')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
            </div>
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('email.security')}</label>
          {/* SMTP security pill row — shared SegmentedControl, compact size (§4 soft-tint pill). */}
          <SegmentedControl
            size="compact"
            ariaLabel={t('email.security')}
            options={[
              { value: 'tls',  label: t('email.secTls') },
              { value: 'ssl',  label: t('email.secSsl') },
              { value: 'none', label: t('email.secNone') },
            ]}
            value={smtpSecure}
            onChange={onSecureChange}
          />
        </div>
      </div>
  )
}
