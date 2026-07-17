/**
 * SecuritySettings — shows MFA status and lets the user enable (via the shared
 * MfaSetupWizard: QR → confirm → recovery codes) or disable (re-enter TOTP code)
 * two-factor authentication. PERSONAL only: the tenant-wide enforcement toggle
 * lives in CompanySettings (org policy ≠ profile — Danny 16-07), this screen is
 * also embedded in the profile page.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ArrowLeft, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import MfaSetupWizard from '@/components/auth/MfaSetupWizard'
import { BTN_H } from '@/config/buttonMetrics'

export default function SecuritySettings() {
  const { t } = useTranslation('settings')
  const { user, setupMfa, confirmMfa, disableMfa, refreshUser } = useAuth()
  // 'idle' | 'wizard' | 'disabling'
  const [step,        setStep]        = useState('idle')
  const [disableCode, setDisableCode] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const mfaEnabled = user?.mfa_enabled === true

  const reset = () => { setStep('idle'); setDisableCode(''); setError('') }

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

  // Enrollment wizard (QR → confirm → recovery) — shared with the enforcement gate.
  if (step === 'wizard') return (
    <MfaSetupWizard setupMfa={setupMfa} confirmMfa={confirmMfa}
      onConfirmed={refreshUser} onFinished={reset} onCancel={reset} />
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
        <input type="text" inputMode="numeric" value={disableCode} aria-label={t('security.codeLabel')}
          onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456" maxLength={6} required autoFocus
          style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                   fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: 'var(--text)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-danger)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        {error && (
          <div style={{ fontSize: 13, color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                         border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}
        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <button type="submit" disabled={loading || disableCode.length < 6}
          style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   border: 'none', cursor: (loading || disableCode.length < 6) ? 'not-allowed' : 'pointer',
                   background: (loading || disableCode.length < 6) ? 'var(--border)' : 'var(--color-danger)', color: 'white' }}>
          {loading ? t('security.working') : t('security.disableBtn')}
        </button>
      </form>
    </div>
  )

  // Idle view — status + action, plus the admin-only organisation policy block.
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
            // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
            <button onClick={() => { setStep('disabling'); setError('') }}
              style={{ height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                       cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', flexShrink: 0 }}>
              {t('security.disable')}
            </button>
          ) : (
            <button onClick={() => { setStep('wizard'); setError('') }}
              style={{ height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                       cursor: 'pointer', border: 'none',
                       background: 'var(--color-primary)', color: 'white', flexShrink: 0 }}>
              {t('security.enable')}
            </button>
          )
        }
      </div>
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
