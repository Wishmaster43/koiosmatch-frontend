/**
 * MfaSetupWizard — the shared TOTP enrollment wizard (QR + secret → confirm code
 * → recovery codes). Used by the Security settings tab AND the full-screen
 * enforcement gate, so the flow exists exactly once. Stays dumb: the API calls
 * arrive via props (from AuthContext), this component only renders the steps.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, Loader2, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

// Loose server payload shapes — AuthContext types these calls as Promise<unknown>.
type SetupResponse   = { otpauth_url?: string; secret?: string }
type ConfirmResponse = { recovery_codes?: string[] }

interface MfaSetupWizardProps {
  /** POST /auth/mfa/setup — returns { secret, otpauth_url }. */
  setupMfa: () => Promise<unknown>
  /** POST /auth/mfa/confirm with the first TOTP code — returns { recovery_codes }. */
  confirmMfa: (code: string) => Promise<unknown>
  /** Fires right after a successful confirm (e.g. refresh the profile). */
  onConfirmed?: () => void | Promise<void>
  /** Fires when the user closes the recovery-codes step ("Done"). */
  onFinished: () => void | Promise<void>
  /** Optional back/cancel action; omit to hide the back link (enforcement gate). */
  onCancel?: () => void
}

export default function MfaSetupWizard({ setupMfa, confirmMfa, onConfirmed, onFinished, onCancel }: MfaSetupWizardProps) {
  const { t } = useTranslation('settings')
  // 'loading' (fetching QR) | 'setup' (QR + confirm code) | 'recovery' (codes shown once)
  const [step,          setStep]          = useState<'loading' | 'setup' | 'recovery'>('loading')
  const [otpauthUrl,    setOtpauthUrl]    = useState('')
  const [secret,        setSecret]        = useState('')
  const [code,          setCode]          = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [busy,          setBusy]          = useState(false)
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState(false)

  // Start enrollment on mount: fetch the QR/secret from the server.
  const startSetup = useCallback(async () => {
    setStep('loading'); setError('')
    try {
      const data = (await setupMfa()) as SetupResponse
      setOtpauthUrl(data?.otpauth_url ?? '')
      setSecret(data?.secret ?? '')
      setStep('setup')
    } catch { setError(t('security.errSetup')) }
  }, [setupMfa, t])

  useEffect(() => { void startSetup() }, [startSetup])

  // Confirm the first TOTP code; on success show the one-time recovery codes.
  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length < 6) return
    setBusy(true); setError('')
    try {
      const data = (await confirmMfa(digits)) as ConfirmResponse
      setRecoveryCodes(data?.recovery_codes ?? [])
      await onConfirmed?.()
      setStep('recovery')
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('security.errInvalidRetry'))
      setCode('')
    }
    setBusy(false)
  }

  // Copy all recovery codes at once so they can be stored in a password manager.
  const copyRecovery = () => {
    void navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  // Close the wizard after the recovery codes were shown.
  const finish = async () => {
    setBusy(true)
    try { await onFinished() } finally { setBusy(false) }
  }

  // Loading / setup-failure view — spinner, or the error with a retry path.
  if (step === 'loading') return (
    <div style={{ maxWidth: 420 }}>
      {error ? (
        <>
          <div role="alert" style={{ fontSize: 13, color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                         border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            {error}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => void startSetup()}
              style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                       cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: 'white' }}>
              {t('security.retry')}
            </button>
            {onCancel && (
              <button onClick={onCancel}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                         border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                {t('security.back')}
              </button>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <Loader2 size={15} className="animate-spin" /> {t('security.working')}
        </div>
      )}
    </div>
  )

  // Recovery codes view (shown once after a successful confirm).
  if (step === 'recovery') return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    background: 'var(--color-success-bg)', border: '1px solid color-mix(in srgb, var(--color-success) 45%, transparent)', borderRadius: 12, marginBottom: 24 }}>
        <ShieldCheck size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>{t('security.enabledTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 2 }}>{t('security.enabledDesc')}</div>
        </div>
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('security.recoveryCodes')}</h3>
      {/* Deliberate fixed dark "terminal" panel: recovery codes must stay high-contrast
          and identical in light AND dark themes (carried over from SecuritySettings). */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <div style={{ background: '#1E1E2E', borderRadius: 10, padding: '16px 20px', marginBottom: 16,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
        {recoveryCodes.map(c => (
          // eslint-disable-next-line no-restricted-syntax -- fixed mint-on-dark code colour, see panel note above
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
        <button onClick={() => void finish()} disabled={busy}
          style={{ height: 34, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   cursor: busy ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--color-primary)', color: 'white' }}>
          {busy ? t('security.working') : t('security.done')}
        </button>
      </div>
    </div>
  )

  // QR + secret + first-code confirm view.
  return (
    <div style={{ maxWidth: 420 }}>
      {onCancel && (
        <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                                            color: 'var(--text-muted)', background: 'none', border: 'none',
                                            cursor: 'pointer', padding: 0, marginBottom: 20 }}>
          <ArrowLeft size={13} /> {t('security.back')}
        </button>
      )}
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
      <form onSubmit={e => void confirmSetup(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label htmlFor="mfa-wizard-code" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
            {t('security.codeLabel')}
          </label>
          <input id="mfa-wizard-code" type="text" inputMode="numeric" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456" maxLength={6} required autoFocus
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                     fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: 'var(--text)',
                     boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        </div>
        {error && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                         border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={busy || code.length < 6}
          style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   border: 'none', cursor: (busy || code.length < 6) ? 'not-allowed' : 'pointer',
                   background: (busy || code.length < 6) ? 'var(--border)' : 'var(--color-primary)', color: 'white' }}>
          {busy ? t('security.working') : t('security.confirmEnable')}
        </button>
      </form>
    </div>
  )
}
