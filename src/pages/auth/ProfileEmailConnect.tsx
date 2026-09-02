/**
 * ProfileEmailConnect — the logged-in user's PERSONAL mailbox connection, so they
 * can email candidates/clients from their own address. Three providers:
 *   - Office 365 / Gmail → OAuth (backend returns a consent URL we redirect to)
 *   - SMTP               → manual host/port/credentials form
 *
 * Distinct from the tenant-wide email in Settings (the shared/general sender).
 *
 * Backend contract:
 *   GET  /profile/email                 -> { status, provider?, email? }
 *   POST /profile/email/connect {provider} -> { url }   (oauth: we redirect)
 *   POST /profile/email/smtp {host,port,user,pass,secure,from_name,from_email}
 *                                       -> { status:'connected', email }
 *   POST /profile/email/disconnect      -> { status:'disconnected' }
 * A 404 degrades to a calm "unavailable" state.
 */
import { useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Eye, EyeOff } from 'lucide-react'
import { useEmailConnection } from './useEmailConnection'
import type { SmtpForm } from './useEmailConnection'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { SectionTitle, formLabelStyle } from '@/components/ui/typography'

const PROVIDERS = [
  { id: 'office', label: 'Office 365' },
  { id: 'gmail',  label: 'Gmail' },
  { id: 'smtp',   label: 'SMTP' },
]

// Canon field style (G33/fieldMetrics) — was its own height-36 copy.
const inputStyle: CSSProperties = fieldInputStyle
// Shared FormLabel identity (12/500/muted) + this file's own layout (§4: identity from the atom, layout local).
const labelStyle: CSSProperties = { ...formLabelStyle, marginBottom: 5, display: 'block' }

// The signed-in user's personal mailbox connector (OAuth for Office 365/Gmail, manual form for SMTP), distinct from the tenant-wide sender in Settings (see file header).
export default function ProfileEmailConnect() {
  const { t } = useTranslation('auth')
  // Data layer: connection state + the OAuth/SMTP connect flows and disconnect (§3).
  const { status, info, busy, connectOauth, saveSmtp, disconnect } = useEmailConnection()
  const [choice,   setChoice]   = useState('office')
  const [showPass, setShowPass] = useState(false)
  const [smtp, setSmtp] = useState<SmtpForm>({ host: '', port: '587', user: '', pass: '', secure: 'tls', from_name: '', from_email: '' })

  // Build a change handler for a single SMTP field.
  const setF = (k: keyof SmtpForm) => (e: ChangeEvent<HTMLInputElement>) => setSmtp(s => ({ ...s, [k]: e.target.value }))

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16, lineHeight: 1.6 }}>
        {t('profile.email.desc')}
      </p>

      {status === 'loading' && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('profile.email.loading')}</p>}

      {status === 'unavailable' && (
        <div style={{ padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border)',
                      borderRadius: 10, fontSize: 13, color: 'var(--text-muted)' }}>
          {t('profile.email.unavailable')}
        </div>
      )}

      {status === 'connected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                      background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--color-primary-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Mail size={18} color="var(--color-primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SectionTitle as="div">
              {t('profile.email.connected')}{info.provider ? ` · ${PROVIDERS.find(p => p.id === info.provider)?.label ?? info.provider}` : ''}
            </SectionTitle>
            {info.email && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{info.email}</div>}
          </div>
          <Button variant="secondary" onClick={disconnect} disabled={busy}>
            {t('profile.email.disconnect')}
          </Button>
        </div>
      )}

      {status === 'disconnected' && (
        <>
          {/* Provider choice — the shared SegmentedControl IS the house segmented
              selector (§4); the hand-rolled card row predates it (heraudit r4 paydown). */}
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl options={PROVIDERS.map(p => ({ value: p.id, label: p.label }))}
              value={choice} onChange={v => setChoice(v as typeof choice)} ariaLabel={t('profile.email.title')} />
          </div>

          {(choice === 'office' || choice === 'gmail') && (
            <Button variant="primary" onClick={() => connectOauth(choice)} disabled={busy}>
              {busy ? <Spinner size={14} /> : <Mail size={14} />}
              {t('profile.email.connectWith', { provider: PROVIDERS.find(p => p.id === choice)?.label ?? choice })}
            </Button>
          )}

          {choice === 'smtp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div><label style={labelStyle}>{t('profile.email.smtpHost')}</label>
                  {/* Hostname example is locale-invariant DATA (same carve-out as the KP- format). */}
                  <input value={smtp.host} onChange={setF('host')} placeholder="smtp.office365.com" aria-label={t('profile.email.smtpHost')} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('profile.email.port')}</label>
                  <input type="number" value={smtp.port} onChange={setF('port')} aria-label={t('profile.email.port')} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>{t('profile.email.user')}</label>
                  <input value={smtp.user} onChange={setF('user')} placeholder={t('common:placeholders.emailExample')} aria-label={t('profile.email.user')} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('profile.email.pass')}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} value={smtp.pass} onChange={setF('pass')}
                      aria-label={t('profile.email.pass')}
                      style={{ ...inputStyle, paddingRight: 36 }} />
                    <Button variant="ghost" iconOnly size="sm" onClick={() => setShowPass(s => !s)}
                      title={showPass ? t('profile.email.hidePassword') : t('profile.email.showPassword')}
                      aria-label={showPass ? t('profile.email.hidePassword') : t('profile.email.showPassword')}
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>{t('profile.email.fromName')}</label>
                  <input value={smtp.from_name} onChange={setF('from_name')} placeholder={t('common:placeholders.fullNameExample')} aria-label={t('profile.email.fromName')} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('profile.email.fromEmail')}</label>
                  <input type="email" value={smtp.from_email} onChange={setF('from_email')} placeholder={t('common:placeholders.emailExample')} aria-label={t('profile.email.fromEmail')} style={inputStyle} /></div>
              </div>
              <div>
                <label style={labelStyle}>{t('profile.email.security')}</label>
                {/* TLS choice — compact SegmentedControl (same reasoning as the provider row). */}
                <SegmentedControl size="compact" options={['tls', 'ssl', 'none'].map(sec => ({ value: sec, label: t(`profile.email.sec_${sec}`) }))}
                  value={smtp.secure} onChange={sec => setSmtp(v => ({ ...v, secure: sec }))} ariaLabel={t('profile.email.security')} />
              </div>
              <Button variant="primary" onClick={() => saveSmtp(smtp)} disabled={busy || !smtp.host.trim()} style={{ alignSelf: 'flex-start' }}>
                {busy ? <Spinner size={14} /> : <Mail size={14} />}
                {t('profile.email.saveConnect')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
