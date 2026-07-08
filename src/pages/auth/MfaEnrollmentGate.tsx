/**
 * MfaEnrollmentGate — full-screen blocker shown when the tenant enforces MFA
 * (`mfa.enforced`) and /auth/me flags this user with `mfa_setup_required`.
 * The server already 403s everything except the enrollment surface, so the only
 * ways forward are completing the shared setup wizard or signing out.
 */
import { useTranslation } from 'react-i18next'
import { LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import MfaSetupWizard from '@/components/auth/MfaSetupWizard'

export default function MfaEnrollmentGate() {
  const { t } = useTranslation('auth')
  const auth = useAuth()
  // Defensive: the route guard only renders this with a live auth context.
  if (!auth) return null
  const { setupMfa, confirmMfa, refreshUser, logout } = auth

  return (
    <div className="flex items-center justify-center min-h-screen p-6"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 7%, var(--bg)) 0%, var(--bg) 55%)' }}>
      <main className="w-full" style={{ maxWidth: 520 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
                      padding: '32px 30px 34px', boxShadow: '0 12px 40px rgba(15,23,42,0.10)' }}>
          {/* Why the user is blocked — icon + title + one-line explanation. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-bg)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={22} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('mfaGate.title')}</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
            {t('mfaGate.desc')}
          </p>

          {/* The shared enrollment wizard; finishing refreshes /auth/me which lifts the gate. */}
          <MfaSetupWizard setupMfa={setupMfa} confirmMfa={confirmMfa}
            onFinished={async () => { await refreshUser() }} />
        </div>

        {/* Signing out is the only other allowed action while enforcement blocks the app. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => void logout()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)',
                     background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            <LogOut size={13} /> {t('mfaGate.signOut')}
          </button>
        </div>
      </main>
    </div>
  )
}
