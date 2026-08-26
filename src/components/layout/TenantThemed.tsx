/**
 * TenantThemed — applies the tenant's brand tokens around any subtree that renders
 * OUTSIDE DashboardLayout.
 *
 * Why this exists (Danny 09-08, screenshot): the pop-out windows showed blue Koios
 * buttons while the same buttons were orange in the main window. The tenant brand is
 * applied at runtime by useTenantTheme, which only ever ran inside DashboardLayout —
 * so a pop-out route fell back to the index.css default (#19A5CA, blue) and the
 * second screen silently looked like a different product.
 *
 * Resolving the tenant the same way DashboardLayout does (switched-to tenant first,
 * then the user's own) keeps a super admin's pop-out on the tenant they are actually
 * looking at, not on their home tenant.
 */
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTenantTheme } from '@/hooks/useTenantTheme'

// Applies the resolved tenant's brand tokens to a subtree outside DashboardLayout,
// (fixes pop-out windows rendering the default brand colour).
export default function TenantThemed({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const tenant = auth?.activeTenant ?? auth?.user?.tenant ?? null
  useTenantTheme(tenant)
  return <>{children}</>
}
