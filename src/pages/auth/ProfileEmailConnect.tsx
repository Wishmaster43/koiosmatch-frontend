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
import { Mail, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { useEmailConnection } from './useEmailConnection'
import type { SmtpForm } from './useEmailConnection'

const PROVIDERS = [
  { id: 'office', label: 'Office 365' },
  { id: 'gmail',  label: 'Gmail' },
  { id: 'smtp',   label: 'SMTP' },
]

const inputStyle: CSSProperties = {
  height: 36, width: '100%', padding: '0 12px', fontSize: 13, boxSizing: 'border-box',
  background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 8, outline: 'none',
}
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, display: 'block' }

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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {t('profile.email.connected')}{info.provider ? ` · ${PROVIDERS.find(p => p.id === info.provider)?.label ?? info.provider}` : ''}
            </div>
            {info.email && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{info.email}</div>}
          </div>
          <button onClick={disconnect} disabled={busy}
            style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                     border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                     cursor: busy ? 'default' : 'pointer', flexShrink: 0 }}>
            {t('profile.email.disconnect')}
          </button>
        </div>
      )}

      {status === 'disconnected' && (
        <>
          {/* Provider choice */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => setChoice(p.id)}
                style={{ flex: 1, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                         border: `1.5px solid ${choice === p.id ? 'var(--color-primary)' : 'var(--border)'}`,
                         background: choice === p.id ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                         color: choice === p.id ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                {p.label}
              </button>
            ))}
          </div>

          {(choice === 'office' || choice === 'gmail') && (
            <button onClick={() => connectOauth(choice)} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px',
                       fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', color: 'white',
                       background: 'var(--color-primary)', cursor: busy ? 'default' : 'pointer' }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
              {t('profile.email.connectWith', { provider: PROVIDERS.find(p => p.id === choice)?.label ?? choice })}
            </button>
          )}

          {choice === 'smtp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div><label style={labelStyle}>{t('profile.email.smtpHost')}</label>
                  <input value={smtp.host} onChange={setF('host')} placeholder="smtp.office365.com" aria-label={t('profile.email.smtpHost')} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('profile.email.port')}</label>
                  <input type="number" value={smtp.port} onChange={setF('port')} aria-label={t('profile.email.port')} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>{t('profile.email.user')}</label>
                  <input value={smtp.user} onChange={setF('user')} placeholder="naam@bedrijf.nl" aria-label={t('profile.email.user')} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('profile.email.pass')}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} value={smtp.pass} onChange={setF('pass')}
                      aria-label={t('profile.email.pass')}
                      style={{ ...inputStyle, paddingRight: 36 }} />
                    <button onClick={() => setShowPass(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                               background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>{t('profile.email.fromName')}</label>
                  <input value={smtp.from_name} onChange={setF('from_name')} placeholder="Danny Polak" aria-label={t('profile.email.fromName')} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('profile.email.fromEmail')}</label>
                  <input type="email" value={smtp.from_email} onChange={setF('from_email')} placeholder="danny@bedrijf.nl" aria-label={t('profile.email.fromEmail')} style={inputStyle} /></div>
              </div>
              <div>
                <label style={labelStyle}>{t('profile.email.security')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['tls', 'ssl', 'none'].map(s => (
                    <button key={s} onClick={() => setSmtp(v => ({ ...v, secure: s }))}
                      style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                               border: `1px solid ${smtp.secure === s ? 'var(--color-primary)' : 'var(--border)'}`,
                               background: smtp.secure === s ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                               color: smtp.secure === s ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                      {t(`profile.email.sec_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => saveSmtp(smtp)} disabled={busy || !smtp.host.trim()}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px',
                         fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', color: 'white',
                         background: 'var(--color-primary)', cursor: busy ? 'default' : 'pointer',
                         opacity: smtp.host.trim() ? 1 : 0.5 }}>
                {busy ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                {t('profile.email.saveConnect')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
