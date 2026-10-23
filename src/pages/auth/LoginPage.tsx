/**
 * LoginPage — email/password sign-in with optional MFA step-up.
 *
 * Flow:
 *   1. User submits email + password.
 *   2a. Backend returns { token, user } → logged in, navigate to /.
 *   2b. Backend returns { mfa_required: true, mfa_token } → show TOTP input.
 *   3. User enters 6-digit code → POST /auth/mfa/verify → logged in.
 */
import { useState, useRef, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useGuardedSubmit } from '@/hooks/useGuardedSubmit'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import { PageTitle, BodyText, FormLabel } from '@/components/ui/typography'
import LoginShell from '@/components/auth/LoginShell'
import { AuthTextField, AuthPasswordField } from '@/components/auth/AuthFields'
import { retryAfterOf } from '@/lib/retryAfter'
// DUP-04: one shared axios-error → message extractor, never a re-derived inline dance.
import { extractApiError } from '@/lib/extractApiError'
import { isNoOrganisationError, NO_ORGANISATION_FLAG } from '@/lib/orphanAccount'
import { SESSION_REVOKED_FLAG, isMfaChallengeUsedError } from '@/lib/sessionCodes'


// ── Step 1: email + password ──────────────────────────────────────────────────
function CredentialForm({ onMfaRequired, notice }: { onMfaRequired: (token: string) => void; notice?: string }) {
  const { t } = useTranslation('auth')
  const { login }  = useAuth() ?? {}
  const navigate   = useNavigate()
  const [email,    setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]   = useState('')
  // Seconds until the login throttle lifts (null = not throttled). Counted down live.
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  // Set by api.js when a 401 ended the previous session — show a hint, then clear.
  const [expired] = useState(() => sessionStorage.getItem('km_session_expired') === '1')
  // ONIX C-003: the previous session ended because the account hangs on no organisation.
  const [orphaned] = useState(() => sessionStorage.getItem(NO_ORGANISATION_FLAG) === '1')
  // ONIX C-005: a credential event revoked the previous session (wins over the plain expired hint).
  const [revoked] = useState(() => sessionStorage.getItem(SESSION_REVOKED_FLAG) === '1')
  useEffect(() => { if (expired) sessionStorage.removeItem('km_session_expired') }, [expired])
  useEffect(() => { if (revoked) sessionStorage.removeItem(SESSION_REVOKED_FLAG) }, [revoked])
  useEffect(() => { if (orphaned) sessionStorage.removeItem(NO_ORGANISATION_FLAG) }, [orphaned])

  // Tick the throttle countdown once per second; at 0 the notice clears and the
  // submit button re-enables — the promise in the text stays true.
  useEffect(() => {
    if (retryAfter === null) return
    if (retryAfter <= 0) { setRetryAfter(null); return }
    const timer = setTimeout(() => setRetryAfter(s => (s === null ? null : s - 1)), 1000)
    return () => clearTimeout(timer)
  }, [retryAfter])

  // Submit credentials: routes to the MFA step when the server asks for it,
  // otherwise navigates straight in; a 429 starts the live throttle countdown.
  const runLogin = async () => {
    setError('')
    setRetryAfter(null)
    try {
      const result = await login?.(email, password)
      if (result && 'mfaRequired' in result && result.mfaRequired) {
        onMfaRequired(String(result.mfaToken))
      } else {
        navigate('/')
      }
    } catch (err) {
      // A throttled 429 gets the live countdown; every other failure keeps the
      // existing message path.
      const secs = retryAfterOf(err)
      if (secs !== null) setRetryAfter(secs)
      else if (isNoOrganisationError(err)) setError(t('login.noOrganisation'))
      else setError(extractApiError(err, t('login.failed')))
    }
  }
  // ONIX C-002: one login in flight, so two Enter presses in one tick fire a single request.
  const { submit, saving: loading } = useGuardedSubmit(runLogin)
  const handleSubmit = (e: FormEvent) => { e.preventDefault(); void submit() }

  const throttled = retryAfter !== null && retryAfter > 0

  return (
    <>
      <PageTitle as="h1" style={{ marginBottom: 4 }}>{t('login.title')}</PageTitle>
      <BodyText style={{ color: 'var(--text-muted)', marginBottom: 32 }}>{t('login.subtitle')}</BodyText>

      {orphaned && !error && (
        <div style={{ marginBottom: 16 }}>
          <CalloutBox variant="danger">{t('login.noOrganisation')}</CalloutBox>
        </div>
      )}
      {(revoked || expired) && !orphaned && !error && (
        <div style={{ marginBottom: 16 }}>
          <CalloutBox variant="warning">{revoked ? t('login.sessionRevoked') : t('login.sessionExpired')}</CalloutBox>
        </div>
      )}
      {notice && !error && (
        <div style={{ marginBottom: 16 }}>
          <CalloutBox variant="warning">{notice}</CalloutBox>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthTextField id="login-email" label={t('login.email')} type="email" value={email} onChange={setEmail}
          placeholder={t('login.emailPlaceholder')} required autoFocus />

        <AuthPasswordField id="login-password" label={t('login.password')} value={password} onChange={setPassword}
          placeholder={t('login.password')} required
          showLabel={t('login.showPassword')} hideLabel={t('login.hidePassword')} />


        {error && <ErrorBanner>{error}</ErrorBanner>}

        {/* Throttle notice — calm (expected state, not an error), with a LIVE countdown.
            `live="polite"` so the per-second re-render announces politely, not as an
            assertive interruption every tick (§6). */}
        {throttled && (
          <CalloutBox variant="warning" live="polite">
            {t('login.throttled', { seconds: retryAfter })}
          </CalloutBox>
        )}

        <Button type="submit" variant="soft" size="md" disabled={loading || throttled}
          style={{ width: '100%' }}>
          {loading && <Spinner size={15} />}
          {loading ? t('login.busy') : t('login.signIn')}
        </Button>
      </form>
    </>
  )
}

// ── Step 2: TOTP verification ─────────────────────────────────────────────────
function MfaForm({ mfaToken, onBack, onChallengeUsed }: { mfaToken: string; onBack: () => void; onChallengeUsed: () => void }) {
  const { t } = useTranslation('auth')
  const { verifyMfa } = useAuth() ?? {}
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [code,    setCode]    = useState('')
  const [error,   setError]   = useState('')

  // Focus the code input as soon as this step mounts, so typing can start immediately.
  useEffect(() => { inputRef.current?.focus() }, [])

  // Submit the entered TOTP code; a rejected code clears the field and refocuses it.
  const runVerify = async () => {
    if (code.replace(/\s/g, '').length < 6) return
    setError('')
    try {
      await verifyMfa?.(mfaToken, code.replace(/\s/g, ''))
      navigate('/')
    } catch (err) {
      // ONIX C-002: a spent challenge cannot be retried, so return to the credentials step.
      if (isMfaChallengeUsedError(err)) { onChallengeUsed(); return }
      setError(extractApiError(err, t('mfa.invalid')))
      setCode('')
      inputRef.current?.focus()
    }
  }
  // ONIX C-002: one verify in flight, so a double Enter fires a single request.
  const { submit, saving: loading } = useGuardedSubmit(runVerify)
  const handleSubmit = (e: FormEvent) => { e.preventDefault(); void submit() }

  // Auto-submit when 6 digits are entered
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
    if (val.length === 6) {
      const form = e.target.form
      setTimeout(() => form?.requestSubmit(), 50)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-bg)',
                       display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={22} style={{ color: 'var(--color-primary-text)' }} />
        </div>
        <div>
          <PageTitle as="h1">{t('mfa.title')}</PageTitle>
          <BodyText style={{ color: 'var(--text-muted)' }}>{t('mfa.openApp')}</BodyText>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
        {t('mfa.instructions')}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <FormLabel htmlFor="mfa-code" style={{ display: 'block', marginBottom: 6 }}>{t('mfa.codeLabel')}</FormLabel>
          <input id="mfa-code" ref={inputRef} type="text" inputMode="numeric" pattern="\d{6}"
            value={code} onChange={handleChange}
            placeholder="123456" maxLength={6} required
            className="w-full rounded-lg"
            style={{ padding: '12px 14px', border: '1px solid var(--border)', outline: 'none', background: 'var(--input-bg)', color: 'var(--text)',
                     fontSize: 20, letterSpacing: '0.25em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button type="submit" variant="soft" size="md" disabled={loading || code.length < 6}
          style={{ width: '100%' }}>
          {loading && <Spinner size={15} />}
          {loading ? t('mfa.verifying') : t('mfa.verify')}
        </Button>

        <Button type="button" variant="ghost" onClick={onBack} style={{ width: '100%' }}>
          <ArrowLeft size={13} /> {t('mfa.back')}
        </Button>
      </form>
    </>
  )
}

// ── Root: orchestrates the two steps ─────────────────────────────────────────
export default function LoginPage() {
  const { t } = useTranslation('auth')
  const [mfaToken, setMfaToken] = useState<string | null>(null) // null = step 1, string = step 2
  // Notice carried back to the credentials step when the MFA challenge was already used.
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const challengeUsed = () => { setMfaToken(null); setNotice(t('mfa.challengeUsed')) }

  return (
    <LoginShell>
      {mfaToken
        ? <MfaForm mfaToken={mfaToken} onBack={() => setMfaToken(null)} onChallengeUsed={challengeUsed} />
        : <CredentialForm onMfaRequired={tok => { setNotice(undefined); setMfaToken(tok) }} notice={notice} />
      }
    </LoginShell>
  )
}
