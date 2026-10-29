/**
 * AuthWallShell — shared full-screen wall layout (gradient page, card with icon tile,
 * title, description, body slot, sign-out below). Used by the MFA enrollment gate and
 * the tenant pick page so both walls look identical.
 */
import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PageTitle, BodyText } from '@/components/ui/typography'

interface AuthWallShellProps {
  icon: ReactNode
  title: string
  description: string
  signOutLabel: string
  onSignOut: () => void
  children: ReactNode
}

export default function AuthWallShell({ icon, title, description, signOutLabel, onSignOut, children }: AuthWallShellProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-6"
      style={{ background: 'var(--auth-backdrop)' }}>
      <main className="w-full" style={{ maxWidth: 520 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
                      padding: '32px 30px 34px', boxShadow: 'var(--shadow-modal)' }}>
          {/* Why the user is blocked: icon + title + one-line explanation. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-bg)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <PageTitle as="h1">{title}</PageTitle>
          </div>
          <BodyText style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>{description}</BodyText>
          {children}
        </div>

        {/* Signing out is the only other allowed action while a wall blocks the app. */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut size={13} /> {signOutLabel}
          </Button>
        </div>
      </main>
    </div>
  )
}
