import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Inloggen mislukt. Controleer je gegevens.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Links - branding */}
      <div className="flex-col justify-between hidden w-2/5 p-12 lg:flex" style={{ background: 'var(--sidebar-bg)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--color-primary)' }}>
            <Zap size={18} color="white" />
          </div>
          <span className="font-mono text-base font-semibold tracking-wide" style={{ color: 'var(--sidebar-text)' }}>
            koios
          </span>
        </div>

        <div>
          <p className="mb-4 text-3xl font-semibold leading-snug" style={{ color: 'var(--sidebar-text)' }}>
            Flex planning,<br />geautomatiseerd.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--sidebar-muted)' }}>
            Koppel je planningsysteem, stuur WhatsApp berichten en laat AI het werk doen.
          </p>
        </div>

        <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
          2025 Koios Solutions
        </p>
      </div>

      {/* Rechts - formulier */}
      <div className="flex items-center justify-center flex-1 p-8">
        <div className="w-full max-w-sm">

          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--color-primary)' }}>
              <Zap size={14} color="white" />
            </div>
            <span className="font-mono text-sm font-semibold">koios</span>
          </div>

          <h1 className="mb-1 text-2xl font-semibold text-gray-900">Inloggen</h1>
          <p className="mb-8 text-sm text-gray-500">Log in op je Koios account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jij@bedrijf.nl"
                required
                autoFocus
                className="w-full text-sm text-gray-900 bg-white rounded-lg"
                style={{ padding: '10px 12px', border: '1px solid #E5E7EB', outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Wachtwoord</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Wachtwoord"
                  required
                  className="w-full text-sm text-gray-900 bg-white rounded-lg"
                  style={{ padding: '10px 40px 10px 12px', border: '1px solid #E5E7EB', outline: 'none' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-full gap-2 text-sm font-medium text-white transition-opacity rounded-lg"
              style={{ padding: '11px', background: loading ? '#9CA3AF' : 'var(--color-primary)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Bezig...' : 'Inloggen'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}