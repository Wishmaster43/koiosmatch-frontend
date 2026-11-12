/**
 * OffboardingPage — calm full-page notice for a bureau in its offboarding grace.
 * One action only: sign out. Reuses the shared wall shell.
 */
import { useTranslation } from 'react-i18next'
import { Hourglass, Building2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import AuthWallShell from '@/components/auth/AuthWallShell'
import Button from '@/components/ui/Button'

// A super admin manages the offboarding itself, so the wall must not trap them: dropping the
// pinned bureau and reloading brings the bureau picker back (the stored pin is the only input).
function switchBureau() {
  try { localStorage.removeItem('active_tenant') } catch { /* storage may be unavailable */ }
  window.location.assign('/')
}

export default function OffboardingPage({ dueAt }: { dueAt: string | null }) {
  const { t } = useTranslation('auth')
  const auth = useAuth()
  const { formatDate } = useDateFormat()
  // Defensive: the wall only renders with a live auth context.
  if (!auth) return null
  const body = dueAt ? t('offboarding.body', { date: formatDate(dueAt) }) : t('offboarding.bodyNoDate')
  // Optional chaining: a minimal auth context (tests, legacy providers) carries no isSuperAdmin.
  const superAdmin = auth.isSuperAdmin?.() ?? false
  return (
    <AuthWallShell icon={<Hourglass size={22} style={{ color: 'var(--color-primary-text)' }} />}
      title={t('offboarding.title')} description={body}
      signOutLabel={t('offboarding.signOut')} onSignOut={() => void auth.logout()}>
      {superAdmin ? (
        <Button variant="ghost" size="sm" onClick={switchBureau}>
          <Building2 size={13} /> {t('offboarding.switchBureau')}
        </Button>
      ) : null}
    </AuthWallShell>
  )
}
