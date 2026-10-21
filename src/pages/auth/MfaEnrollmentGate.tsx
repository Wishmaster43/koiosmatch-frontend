/**
 * MfaEnrollmentGate — full-screen blocker shown when the tenant enforces MFA
 * (`mfa.enforced`) and /auth/me flags this user with `mfa_setup_required`.
 * The server already 403s everything except the enrollment surface, so the only
 * ways forward are completing the shared setup wizard or signing out.
 */
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import MfaSetupWizard from '@/components/auth/MfaSetupWizard'
import AuthWallShell from '@/components/auth/AuthWallShell'

export default function MfaEnrollmentGate() {
  const { t } = useTranslation('auth')
  const auth = useAuth()
  // Defensive: the route guard only renders this with a live auth context.
  if (!auth) return null
  const { setupMfa, confirmMfa, refreshUser, logout } = auth

  return (
    <AuthWallShell icon={<ShieldAlert size={22} style={{ color: 'var(--color-primary-text)' }} />}
      title={t('mfaGate.title')} description={t('mfaGate.desc')}
      signOutLabel={t('mfaGate.signOut')} onSignOut={() => void logout()}>
      {/* The shared enrollment wizard; finishing refreshes /auth/me which lifts the gate. */}
      <MfaSetupWizard setupMfa={setupMfa} confirmMfa={confirmMfa}
        onFinished={async () => { await refreshUser() }} />
    </AuthWallShell>
  )
}
