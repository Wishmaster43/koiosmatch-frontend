/**
 * SecuritySettings — shows MFA status and lets the user enable (via the shared
 * MfaSetupWizard: QR → confirm → recovery codes), regenerate recovery codes, or
 * disable two-factor authentication. PERSONAL only: the tenant-wide enforcement
 * toggle lives in CompanySettings (org policy ≠ profile — Danny 16-07).
 */
import { useState, FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ArrowLeft, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import MfaSetupWizard from '@/components/auth/MfaSetupWizard'
import RecoveryCodesPanel from '@/components/auth/RecoveryCodesPanel'
import { SectionTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { tintBorder } from '@/lib/tint'
import { regenerateRecoveryCodes } from '@/lib/mfaApi'
import { notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

// Form shared by disable and regenerate flows: TOTP code input → submit.
const MfaCodeForm: FC<{ title: ReactNode; description: ReactNode; submitLabel: string; submitVariant: 'primary' | 'danger'; code: string; onCodeChange: (code: string) => void; error: string; loading: boolean; onSubmit: (e: React.FormEvent) => Promise<void>; onBack: () => void; t: (key: string) => string }> = ({ title, description, submitLabel, submitVariant, code, onCodeChange, error, loading, onSubmit, onBack, t }) => (
  <div style={{ maxWidth: 420 }}>
    <Button variant="ghost" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6,
                                      padding: 0, marginBottom: 20 }}>
      <ArrowLeft size={13} /> {t('security.back')}
    </Button>
    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</h3>
    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>{description}</p>
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="text" inputMode="numeric" value={code} aria-label={t('security.codeLabel')}
        onChange={e => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456" maxLength={6} required autoFocus
        style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                 fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: 'var(--text)' }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-danger)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
      {error && (
        <div style={{ fontSize: 13, color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
                       border: tintBorder('var(--color-danger)', true), borderRadius: 8, padding: '8px 12px' }}>
          {error}
        </div>
      )}
      <Button type="submit" variant={submitVariant} disabled={loading || code.length < 6}>
        {loading ? t('security.working') : submitLabel}
      </Button>
    </form>
  </div>
)

// Personal MFA status + enable/disable/regenerate flow; a state machine (idle/wizard/disabling/regenerating) switches the whole view.
export default function SecuritySettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const user = auth?.user
  const setupMfa = auth?.setupMfa
  const confirmMfa = auth?.confirmMfa
  const disableMfa = auth?.disableMfa
  const refreshUser = auth?.refreshUser
  // 'idle' | 'wizard' | 'disabling' | 'regenerating' | 'regenerating-codes'
  const [step,           setStep]           = useState('idle')
  const [code,           setCode]           = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [newCodes,       setNewCodes]       = useState<string[]>([])

  const mfaEnabled = user?.mfa_enabled === true

  const reset = () => { setStep('idle'); setCode(''); setError(''); setNewCodes([]) }

  // Submits the disable-MFA TOTP code; strips non-digits before sending, and shows the server's own error (falling back to a generic one) without leaving the entered code in place.
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.replace(/\D/g, '').length < 6) return
    setLoading(true); setError('')
    try {
      await disableMfa?.(code.replace(/\D/g, ''))
      reset()
    } catch (err) {
      const errorMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('security.errInvalid')
      setError(errorMsg)
      setCode('')
    }
    setLoading(false)
  }

  // Regenerate recovery codes: ask for TOTP code, call API, show new codes.
  const handleRegenerateClick = () => {
    setStep('regenerating')
    setCode('')
    setError('')
  }

  const handleRegenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.replace(/\D/g, '').length < 6) return
    setLoading(true); setError('')
    try {
      const { recovery_codes } = await regenerateRecoveryCodes(code.replace(/\D/g, ''))
      setNewCodes(recovery_codes)
      setStep('regenerating-codes')
    } catch (err) {
      setError(extractApiError(err, t('security.errInvalid')))
      setCode('')
    }
    setLoading(false)
  }

  const handleRegenerateDone = async () => {
    notifySuccess(t('security.codesRegenerated'))
    reset()
  }

  // Enrollment wizard (QR → confirm → recovery) — shared with the enforcement gate.
  if (step === 'wizard') return (
    <MfaSetupWizard setupMfa={setupMfa ?? (() => Promise.reject())} confirmMfa={confirmMfa ?? (() => Promise.reject())}
      onConfirmed={refreshUser ? async () => { await refreshUser(); } : undefined} onFinished={reset} onCancel={reset} />
  )

  // Disable confirm view
  if (step === 'disabling') return (
    <MfaCodeForm title={t('security.disableTitle')} description={t('security.disableDesc')}
      submitLabel={t('security.disableBtn')} submitVariant="danger" code={code} onCodeChange={setCode}
      error={error} loading={loading} onSubmit={handleDisable} onBack={reset} t={t} />
  )

  // Regenerate recovery codes view
  if (step === 'regenerating') return (
    <MfaCodeForm title={t('security.regenerateTitle')} description={t('security.regenerateDesc')}
      submitLabel={t('security.regenerateBtn')} submitVariant="primary" code={code} onCodeChange={setCode}
      error={error} loading={loading} onSubmit={handleRegenerateSubmit} onBack={reset} t={t} />
  )

  // Show new recovery codes after regeneration
  if (step === 'regenerating-codes') return (
    <RecoveryCodesPanel codes={newCodes} onDone={handleRegenerateDone} busy={loading}
      headline={
        <div>
          <SectionTitle style={{ marginBottom: 6 }}>{t('security.newCodesTitle')}</SectionTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {t('security.newCodesDesc')}
          </p>
        </div>
      } />
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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {mfaEnabled && (
            <Button variant="secondary" onClick={handleRegenerateClick}>
              {t('security.regenerateCodes')}
            </Button>
          )}
          <Button variant={mfaEnabled ? 'dangerSoft' : 'primary'} size={mfaEnabled ? 'sm' : undefined}
            onClick={() => { setStep(mfaEnabled ? 'disabling' : 'wizard'); setError('') }}>
            {mfaEnabled ? t('security.disable') : t('security.enable')}
          </Button>
        </div>
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
