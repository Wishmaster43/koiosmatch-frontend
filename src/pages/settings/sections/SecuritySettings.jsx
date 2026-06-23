/**
 * SecuritySettings — shows MFA status and lets the user enable (setup QR → confirm
 * → show recovery codes) or disable (re-enter TOTP code) two-factor authentication.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Copy, ArrowLeft, Lock } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../../context/AuthContext'

export default function SecuritySettings() {
  const { t } = useTranslation('settings')
  const { user, setupMfa, confirmMfa, disableMfa, refreshUser } = useAuth()
  // 'idle' | 'setup' | 'confirm' | 'recovery' | 'disabling'
  const [step,          setStep]          = useState('idle')
  const [otpauthUrl,    setOtpauthUrl]    = useState('')
  const [secret,        setSecret]        = useState('')
  const [code,          setCode]          = useState('')
  const [disableCode,   setDisableCode]   = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState(false)

  const mfaEnabled = user?.mfa_enabled === true

  const reset = () => { setStep('idle'); setCode(''); setDisableCode(''); setError(''); setOtpauthUrl(''); setSecret('') }

  const startSetup = async () => {
    setLoading(true); setError('')
    try {
      const data = await setupMfa()
      setOtpauthUrl(data.otpauth_url ?? '')
      setSecret(data.secret ?? '')
      setStep('setup')
    } catch { setError(t('security.errSetup')) }
    setLoading(false)
  }

  const confirmSetup = async (e) => {
    e.preventDefault()
    if (code.replace(/\D/g, '').length < 6) return
    setLoading(true); setError('')
    try {
      const data = await confirmMfa(code.replace(/\D/g, ''))
      setRecoveryCodes(data.recovery_codes ?? [])
      await refreshUser()
      setStep('recovery')
    } catch (err) {
      setError(err.response?.data?.message || t('security.errInvalidRetry'))
      setCode('')
    }
    setLoading(false)
  }

  const handleDisable = async (e) => {
    e.preventDefault()
    if (disableCode.replace(/\D/g, '').length < 6) return
    setLoading(true); setError('')
    try {
      await disableMfa(disableCode.replace(/\D/g, ''))
      reset()
    } catch (err) {
      setError(err.response?.data?.message || t('security.errInvalid'))
      setDisableCode('')
    }
    setLoading(false)
  }

  const copyRecovery = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  // Recovery codes view (shown once after setup)
  if (step === 'recovery') return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    background: 'var(--color-success-bg)', border: '1px solid #86EFAC', borderRadius: 12, marginBottom: 24 }}>
        <ShieldCheck size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>{t('security.enabledTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 2 }}>{t('security.enabledDesc')}</div>
        </div>
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('security.recoveryCodes')}</h3>
      <div style={{ background: '#1E1E2E', borderRadius: 10, padding: '16px 20px', marginBottom: 16,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
        {recoveryCodes.map(c => (
          <span key={c} style={{ fontFamily: 'monospace', fontSize: 13, color: '#A8E6CF', letterSpacing: '0.05em' }}>{c}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={copyRecovery}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                   border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          <Copy size={13} /> {copied ? t('security.copied') : t('security.copy')}
        </button>
        <button onClick={reset}
          style={{ height: 34, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: 'white' }}>
          {t('security.done')}
        </button>
      </div>
    </div>
  )

  // QR + secret view
  if (step === 'setup') return (
    <div style={{ maxWidth: 420 }}>
      <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                                        color: 'var(--text-muted)', background: 'none', border: 'none',
                                        cursor: 'pointer', padding: 0, marginBottom: 20 }}>
        <ArrowLeft size={13} /> {t('security.back')}
      </button>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('security.scanTitle')}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>{t('security.scanDesc')}</p>
      {otpauthUrl && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <QRCodeSVG value={otpauthUrl} size={180} />
          </div>
        </div>
      )}
      {secret && (
        <div style={{ background: 'var(--hover-bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                       textAlign: 'center', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.12em', color: 'var(--text)' }}>
          {secret}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'inherit', letterSpacing: 0 }}>
            {t('security.manualEntry')}
          </div>
        </div>
      )}
      <form onSubmit={confirmSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
            {t('security.codeLabel')}
          </label>
          <input type="text" inputMode="numeric" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456" maxLength={6} required autoFocus
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                     fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: 'var(--text)',
                     boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        </div>
        {error && (
          <div style={{ fontSize: 13, color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                         border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading || code.length < 6}
          style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   border: 'none', cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer',
                   background: (loading || code.length < 6) ? 'var(--border)' : 'var(--color-primary)', color: 'white' }}>
          {loading ? t('security.working') : t('security.confirmEnable')}
        </button>
      </form>
    </div>
  )

  // Disable confirm view
  if (step === 'disabling') return (
    <div style={{ maxWidth: 420 }}>
      <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                                        color: 'var(--text-muted)', background: 'none', border: 'none',
                                        cursor: 'pointer', padding: 0, marginBottom: 20 }}>
        <ArrowLeft size={13} /> {t('security.back')}
      </button>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('security.disableTitle')}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>{t('security.disableDesc')}</p>
      <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="text" inputMode="numeric" value={disableCode}
          onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456" maxLength={6} required autoFocus
          style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                   fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: 'var(--text)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-danger)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        {error && (
          <div style={{ fontSize: 13, color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                         border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading || disableCode.length < 6}
          style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   border: 'none', cursor: (loading || disableCode.length < 6) ? 'not-allowed' : 'pointer',
                   background: (loading || disableCode.length < 6) ? 'var(--border)' : 'var(--color-danger)', color: 'white' }}>
          {loading ? t('security.working') : t('security.disableBtn')}
        </button>
      </form>
    </div>
  )

  // Idle view — status + action
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: mfaEnabled ? 'var(--color-success-bg)' : 'var(--hover-bg)' }}>
          {mfaEnabled
            ? <ShieldCheck size={22} color="var(--color-success)" />
            : <Lock size={22} color="var(--text-muted)" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('security.twoFactor')}</div>
          <div style={{ fontSize: 12, color: mfaEnabled ? 'var(--color-success)' : 'var(--text-muted)', marginTop: 2 }}>
            {mfaEnabled ? t('security.statusOn') : t('security.statusOff')}
          </div>
        </div>
        {mfaEnabled
          ? (
            <button onClick={() => { setStep('disabling'); setError('') }}
              style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                       cursor: 'pointer', border: '1px solid #FCA5A5', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', flexShrink: 0 }}>
              {t('security.disable')}
            </button>
          ) : (
            <button onClick={startSetup} disabled={loading}
              style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                       cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
                       background: 'var(--color-primary)', color: 'white', flexShrink: 0 }}>
              {loading ? t('security.working') : t('security.enable')}
            </button>
          )
        }
      </div>
      {error && (
        <div style={{ fontSize: 13, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5',
                       borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--hover-bg)',
                    border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('security.supportedApps')}</div>
        {['Google Authenticator', 'Microsoft Authenticator', 'Bitwarden', 'Authy', '1Password'].map(app => (
          <div key={app} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>· {app}</div>
        ))}
      </div>
    </div>
  )
}
