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
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// ── Shared layout wrapper ─────────────────────────────────────────────────────
function LoginShell({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left — branding panel */}
      <div className="flex-col justify-between hidden w-2/5 p-12 lg:flex"
           style={{ background: 'var(--sidebar-bg)' }}>
        <div className="flex items-center gap-3">
          <img src="/KoiosMatch.png" alt="KoiosMatch" className="h-8 w-auto" />
        </div>
        <div>
          <p className="mb-2 text-2xl font-semibold leading-snug"
             style={{ color: 'var(--sidebar-text)' }}>
            ATS, CRM, Planning<br />en rapportage.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--sidebar-muted)' }}>
            Workflow AI agents, koppelingen en automatisering — alles in één platform.
          </p>
        </div>

        {/* Koios AI agent illustration */}
        <div className="flex flex-col items-center flex-1 justify-center">
          <img
            src="/koios-agent.png"
            alt="Koios AI agent"
            className="w-full object-cover rounded-2xl opacity-90"
            style={{ boxShadow: '0 0 40px rgba(99,102,241,0.3)' }}
          />
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold mb-1" style={{ color: 'var(--sidebar-text)' }}>
            Koios
          </p>
          <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
            Jouw intelligente AI agent
          </p>
        </div>

        <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>2025 KoiosMatch</p>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center flex-1 p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/KoiosMatch.png" alt="KoiosMatch" className="h-7 w-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: email + password ──────────────────────────────────────────────────
function CredentialForm({ onMfaRequired }) {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [email,    setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]  = useState(false)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result?.mfaRequired) {
        onMfaRequired(result.mfaToken)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Inloggen mislukt. Controleer je gegevens.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Inloggen</h1>
      <p className="mb-8 text-sm text-gray-500">Log in op je KoiosMatch account</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">E-mailadres</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="jij@bedrijf.nl" required autoFocus
            className="w-full text-sm text-gray-900 bg-white rounded-lg"
            style={{ padding: '10px 12px', border: '1px solid #E5E7EB', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Wachtwoord</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Wachtwoord" required
              className="w-full text-sm text-gray-900 bg-white rounded-lg"
              style={{ padding: '10px 40px 10px 12px', border: '1px solid #E5E7EB', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="flex items-center justify-center w-full gap-2 text-sm font-medium text-white transition-opacity rounded-lg"
          style={{ padding: '11px', background: loading ? '#9CA3AF' : 'var(--color-primary)',
                   border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>
    </>
  )
}

// ── Step 2: TOTP verification ─────────────────────────────────────────────────
function MfaForm({ mfaToken, onBack }) {
  const { verifyMfa } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (code.replace(/\s/g, '').length < 6) return
    setError('')
    setLoading(true)
    try {
      await verifyMfa(mfaToken, code.replace(/\s/g, ''))
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Ongeldige code. Probeer opnieuw.')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when 6 digits are entered
  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
    if (val.length === 6) {
      setTimeout(() => e.target.form?.requestSubmit(), 50)
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
          <h1 className="text-xl font-semibold text-gray-900">Twee-factor verificatie</h1>
          <p className="text-sm text-gray-500">Open je authenticator app</p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>
        Voer de 6-cijferige code in die je authenticator app toont. De code is 30 seconden geldig.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Verificatiecode</label>
          <input ref={inputRef} type="text" inputMode="numeric" pattern="\d{6}"
            value={code} onChange={handleChange}
            placeholder="123456" maxLength={6} required
            className="w-full text-sm text-gray-900 bg-white rounded-lg"
            style={{ padding: '12px 14px', border: '1px solid #E5E7EB', outline: 'none',
                     fontSize: 20, letterSpacing: '0.25em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || code.length < 6}
          className="flex items-center justify-center w-full gap-2 text-sm font-medium text-white transition-opacity rounded-lg"
          style={{ padding: '11px',
                   background: (loading || code.length < 6) ? '#9CA3AF' : 'var(--color-primary)',
                   border: 'none', cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer' }}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Verifiëren…' : 'Verifiëren'}
        </button>

        <button type="button" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                   fontSize: 13, color: '#6B7280', background: 'none', border: 'none',
                   cursor: 'pointer', padding: '4px 0' }}>
          <ArrowLeft size={13} /> Terug naar inloggen
        </button>
      </form>
    </>
  )
}

// ── Root: orchestrates the two steps ─────────────────────────────────────────
export default function LoginPage() {
  const [mfaToken, setMfaToken] = useState(null) // null = step 1, string = step 2

  return (
    <LoginShell>
      {mfaToken
        ? <MfaForm mfaToken={mfaToken} onBack={() => setMfaToken(null)} />
        : <CredentialForm onMfaRequired={setMfaToken} />
      }
    </LoginShell>
  )
}
