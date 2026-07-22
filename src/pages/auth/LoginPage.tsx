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
import type { FormEvent, ChangeEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import ErrorBanner from '@/components/ui/ErrorBanner'

// Read a server-provided error message off an axios-style error, if present.
const messageOf = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message

// Typographic wordmark — a crisp placeholder until the final logo asset is delivered
// (then swap <Wordmark/> for an <img>). Reads well on any background via tokens.
function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className} style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--sidebar-text)', whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--color-primary)' }}>Koios</span>Match
    </span>
  )
}

// ── Shared layout wrapper — balanced brand hero left, login card right. ────────
function LoginShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth')
  // Copyright year is dynamic — never a stale hardcoded value.
  const year = new Date().getFullYear()
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Left — brand hero: a balanced Koios agent on a calm wash of the three brand colours. */}
      <div className="relative flex-col items-center hidden w-1/2 p-12 overflow-hidden text-center lg:flex xl:w-[55%]"
        style={{ background: [
          'radial-gradient(90% 70% at 14% 6%, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent 56%)',
          'radial-gradient(85% 75% at 92% 26%, color-mix(in srgb, var(--color-secondary) 17%, transparent), transparent 56%)',
          'radial-gradient(72% 62% at 82% 100%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 55%)',
          'var(--sidebar-bg)',
        ].join(', ') }}>
        <Wordmark className="relative" />

        {/* Brand statement — the single headline, centred above the illustration. */}
        <p className="relative mt-10 font-semibold leading-snug" style={{ color: 'var(--sidebar-text)', fontSize: 27, maxWidth: 520 }}>
          {t('brand.sub')}
        </p>

        {/* Agent — balanced hero: centred with breathing room, capped so it never dominates or crops. */}
        <div className="relative flex items-center justify-center flex-1 min-h-0 py-6">
          <img src="/koios-agent.jpg" alt="Koios AI agent"
            className="object-contain rounded-3xl"
            style={{ maxHeight: '58%', maxWidth: '80%', filter: 'drop-shadow(0 12px 48px rgba(25,165,202,0.28))' }} />
        </div>

        <p className="relative text-xs" style={{ color: 'var(--sidebar-muted)' }}>© {year} KoiosMatch</p>
      </div>

      {/* Right — login card on a soft primary tint. */}
      <div className="relative flex items-center justify-center flex-1 p-6 sm:p-10"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 7%, var(--bg)) 0%, var(--bg) 55%)' }}>
        <div className="w-full" style={{ maxWidth: 400 }}>
          <div className="flex items-center justify-center gap-2 mb-6 lg:hidden">
            <Wordmark />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
            padding: '32px 30px 34px', boxShadow: '0 12px 40px rgba(15,23,42,0.10)' }}>
            {children}
          </div>
          <p className="mt-6 text-xs text-center lg:hidden" style={{ color: 'var(--text-muted)' }}>© {year} KoiosMatch</p>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: email + password ──────────────────────────────────────────────────
function CredentialForm({ onMfaRequired }: { onMfaRequired: (token: string) => void }) {
  const { t } = useTranslation('auth')
  const { login }  = useAuth() ?? {}
  const navigate   = useNavigate()
  const [email,    setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]  = useState(false)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')
  // Set by api.js when a 401 ended the previous session — show a hint, then clear.
  const [expired] = useState(() => sessionStorage.getItem('km_session_expired') === '1')
  useEffect(() => { if (expired) sessionStorage.removeItem('km_session_expired') }, [expired])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login?.(email, password)
      if (result && 'mfaRequired' in result && result.mfaRequired) {
        onMfaRequired(String(result.mfaToken))
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(messageOf(err) || t('login.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">{t('login.title')}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('login.subtitle')}</p>

      {expired && !error && (
        <div className="mb-4 rounded-lg px-3 py-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200">
          {t('login.sessionExpired', { defaultValue: 'Je sessie is verlopen. Log opnieuw in.' })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-gray-700 mb-1.5">{t('login.email')}</label>
          <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('login.emailPlaceholder')} required autoFocus
            className="w-full text-sm text-gray-900 bg-white rounded-lg"
            style={{ padding: '10px 12px', border: '1px solid var(--border)', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-medium text-gray-700 mb-1.5">{t('login.password')}</label>
          <div className="relative">
            <input id="login-password" type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('login.password')} required
              className="w-full text-sm text-gray-900 bg-white rounded-lg"
              style={{ padding: '10px 40px 10px 12px', border: '1px solid var(--border)', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button type="submit" disabled={loading}
          className="flex items-center justify-center w-full gap-2 text-sm font-medium text-white transition-opacity rounded-lg"
          style={{ padding: '11px', background: loading ? 'var(--text-muted)' : 'var(--color-primary)',
                   border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? t('login.busy') : t('login.signIn')}
        </button>
      </form>
    </>
  )
}

// ── Step 2: TOTP verification ─────────────────────────────────────────────────
function MfaForm({ mfaToken, onBack }: { mfaToken: string; onBack: () => void }) {
  const { t } = useTranslation('auth')
  const { verifyMfa } = useAuth() ?? {}
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.replace(/\s/g, '').length < 6) return
    setError('')
    setLoading(true)
    try {
      await verifyMfa?.(mfaToken, code.replace(/\s/g, ''))
      navigate('/')
    } catch (err) {
      setError(messageOf(err) || t('mfa.invalid'))
      setCode('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

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
          <ShieldCheck size={22} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('mfa.title')}</h1>
          <p className="text-sm text-gray-500">{t('mfa.openApp')}</p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
        {t('mfa.instructions')}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="mfa-code" className="block text-xs font-medium text-gray-700 mb-1.5">{t('mfa.codeLabel')}</label>
          <input id="mfa-code" ref={inputRef} type="text" inputMode="numeric" pattern="\d{6}"
            value={code} onChange={handleChange}
            placeholder="123456" maxLength={6} required
            className="w-full text-sm text-gray-900 bg-white rounded-lg"
            style={{ padding: '12px 14px', border: '1px solid var(--border)', outline: 'none',
                     fontSize: 20, letterSpacing: '0.25em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <button type="submit" disabled={loading || code.length < 6}
          className="flex items-center justify-center w-full gap-2 text-sm font-medium text-white transition-opacity rounded-lg"
          style={{ padding: '11px',
                   background: (loading || code.length < 6) ? 'var(--text-muted)' : 'var(--color-primary)',
                   border: 'none', cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer' }}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? t('mfa.verifying') : t('mfa.verify')}
        </button>

        <button type="button" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                   fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none',
                   cursor: 'pointer', padding: '4px 0' }}>
          <ArrowLeft size={13} /> {t('mfa.back')}
        </button>
      </form>
    </>
  )
}

// ── Root: orchestrates the two steps ─────────────────────────────────────────
export default function LoginPage() {
  const [mfaToken, setMfaToken] = useState<string | null>(null) // null = step 1, string = step 2

  return (
    <LoginShell>
      {mfaToken
        ? <MfaForm mfaToken={mfaToken} onBack={() => setMfaToken(null)} />
        : <CredentialForm onMfaRequired={setMfaToken} />
      }
    </LoginShell>
  )
}
