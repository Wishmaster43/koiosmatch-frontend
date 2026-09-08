import { useAuth } from '@/context/AuthContext'

// SUBENTITY-IMPORT-1 / CUSTOMER-IMPORT-1: a permission check that falls back to "no
// permission" rather than crashing when the auth context is mid-boot OR genuinely
// absent (the customer create modals are also mounted from screens with no
// AuthProvider ancestor in tests). DRY-1 O5: the same fallback was copied in four modals.
export function useSafePermission(): (permission: string) => boolean {
  const authCtx = useAuth() as unknown as { hasPermission?: (permName: string) => boolean } | null
  return authCtx?.hasPermission ?? (() => false)
}
