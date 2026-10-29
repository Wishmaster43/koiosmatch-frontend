/**
 * useBureauScope — the one gate for bureau-scoped loads in the app shell (TENANT-GATE-FE-1,
 * 29-10-2026). The shell's providers mount before login and before the super admin's bureau
 * pick; a bureau route before the pick is a 400 tenant_required by design (ONIX B-003, no
 * first-bureau fallback). `ready` means "a session exists and a bureau is chosen"; `scopeKey`
 * changes on login, right after the pick and on every tenant switch, so an effect keyed on it
 * refetches exactly then (the old `[user?.id]` dependency never did after a pick or a switch).
 */
import { useAuth } from '../AuthContext'

export function useBureauScope(): { ready: boolean; scopeKey: string } {
  const { user, needsTenantPick, activeTenant } = useAuth() ?? {}
  const ready = Boolean(user?.id) && !needsTenantPick
  return { ready, scopeKey: `${user?.id ?? ''}:${activeTenant?.id ?? ''}` }
}
