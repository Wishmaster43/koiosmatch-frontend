/**
 * useTenantCurrency — the tenant's ISO-4217 currency from /auth/me
 * (tenant.currency, I18N-1 lane I3 / K-295 L5; the backend defaults it to EUR).
 * Tenant money (rates, price agreements, opportunity value, salaries) formats in
 * THIS currency unless the record carries its own `currency`; Koios' own billing
 * screens keep EUR explicitly, they invoice the tenant, not the tenant's customers.
 */
import { useAuth } from '@/context/AuthContext'

export const DEFAULT_TENANT_CURRENCY = 'EUR'

// Reads the active tenant first (tenant switch), then the user's own tenant.
export function useTenantCurrency(): string {
  const auth = useAuth()
  return auth?.activeTenant?.currency ?? auth?.user?.tenant?.currency ?? DEFAULT_TENANT_CURRENCY
}
