/**
 * useBackofficeCouplePermissions — the "can this bulk bar offer backoffice
 * coupling, and to which systems" gate shared by candidates/customers (SYNC-BULK-1:
 * same permission as the per-record BackofficeLinksTab's `canLink` — never a new
 * permission — and the same `useApps()` module-availability gate, so a disabled
 * system for this tenant is never offered). Hand-copied identically in both bulk
 * bars before this consolidation.
 */
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'

// One permission string per entity ('candidates.update' | 'customers.update' | …).
export function useBackofficeCouplePermissions(updatePermission: string) {
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  return {
    canCouple: hasPermission(updatePermission),
    showHelloflex: isAppEnabled('hf'),
    showShiftmanager: isAppEnabled('shiftmanager'),
  }
}
