/**
 * useTenantPin — the bureau (tenant) slice of AuthContext: the list, the active bureau, the
 * picker wall and every way they change (stored-bureau resolution, auth-response sync, the
 * super admin's switch, the once-per-boot refusal event, the cross-tab reload). Moved out of
 * AuthContext.tsx (#117, 05-11) with the same state, callbacks, effects and deps; two stable
 * wrappers are new: adoptResponseTenant (the auth-response sync applyAuthResponse ran inline) and
 * resetTenantState (the three setters the expiry handler and logout ran inline).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { TENANT_REQUIRED_EVENT, clearTenantPickSignal, resolveStoredTenant } from '@/lib/tenantResolution'
import type { TenantResolution } from '@/lib/tenantResolution'
import { queryClient } from '@/lib/queryClient'
import type { Tenant } from '@/types/api'
import { userIsSuperAdmin } from './permissions'
import type { AuthUser } from './permissions'
import { loadTenantResolution } from './tenantPin'

// `user` is read through a ref inside the refusal-event handler (REFS-IN-EFFECTS-1), never closed over.
export function useTenantPin(user: AuthUser | null) {
  const [tenants,       setTenants]           = useState<Tenant[]>([])
  // Tracks a failed /tenants fetch so the switcher can render an honest error instead of an empty list (D8).
  const [tenantsError,  setTenantsError]      = useState(false)
  const [activeTenant,  setActiveTenantState] = useState<Tenant | null>(null)
  // Raised when no valid bureau is stored for a super admin (boot, login or a coded refusal).
  const [needsTenantPick, setNeedsTenantPick] = useState(false)

  /**
   * Switch the active tenant (used by super admins).
   * Persists the choice, then re-fetches /auth/me so roles/permissions/context
   * match the newly selected tenant. Stable forever — no state dependency.
   */
  const setActiveTenant = useCallback(async (tenant: Tenant): Promise<void> => {
    localStorage.setItem('active_tenant', tenant.id)
    setActiveTenantState(tenant)
    // A pick lifts the picker wall and re-arms the once-per-boot refusal signal (api.ts).
    setNeedsTenantPick(false)
    clearTenantPickSignal()
    queryClient.clear()
    // React Query is cleared above, but module-level caches (lookups, custom-fields, all-settings,
    // KPI) + context state survive a soft switch and would LEAK the previous tenant's data into the
    // newly selected bureau. Special-category health data (AVG) — isolation must be absolute, so we
    // hard-reload to re-bootstrap the whole app for the new tenant (X-Tenant already points at it).
    window.location.reload()
  }, [])

  // Applies a stored-bureau resolution: pin it, keep the stored id, or raise the picker (never a guess).
  const applyTenantResolution = useCallback((r: TenantResolution) => {
    if (r.kind === 'pinned') {
      localStorage.setItem('active_tenant', r.tenant.id)
      setActiveTenantState(r.tenant)
      setNeedsTenantPick(false)
    } else if (r.kind === 'pick') {
      localStorage.removeItem('active_tenant')
      setActiveTenantState(null)
      setNeedsTenantPick(true)
    } else if (r.kind === 'keepStored') {
      setActiveTenantState(prev => prev ?? ({ id: r.id } as Tenant))
    }
  }, [])

  // TENANT-TAB-1 (Danny 23-07 "elke kandidaat 404t op demo"): localStorage is
  // SHARED across tabs, and the api client reads active_tenant per request. A
  // switch in tab A left tab B rendering the OLD tenant's rows while its new
  // requests already carried the NEW X-Tenant → every detail click 404'd
  // ("rij verwijderd"), and worse: cross-tenant display state (AVG). The
  // storage event fires only in OTHER tabs — hard-reload them too, exactly
  // like the switching tab itself.
  useEffect(() => {
    // Another tab changed the active tenant; reload this tab too so no tenant-scoped state leaks across tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'active_tenant' && e.oldValue !== null && e.newValue !== null && e.newValue !== e.oldValue) {
        window.location.reload()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /**
   * Populate the tenant list + active tenant based on the user's role.
   * - super_admin → load ALL tenants and select the SAVED one; without a valid saved
   *   bureau the picker wall is raised (TENANT-PICKER-FE-1, Danny 4a = A: the server has
   *   no first-bureau fallback any more, so the client never guesses one either).
   * - regular user → use only their own tenant from /auth/me (never call /tenants).
   * Stable forever — every branch overwrites state outright, no read dependency.
   */
  const setupTenants = useCallback(async (u?: AuthUser | null): Promise<void> => {
    const savedTenant = localStorage.getItem('active_tenant')
    if (userIsSuperAdmin(u)) {
      // AWAITED by the restore path (TENANT-HEADER-1): rendering before the
      // active tenant is known let early fetches go out without X-Tenant, and
      // the backend then falls back to the FIRST tenant (demo-data-in-yesway).
      await loadTenantResolution(savedTenant)
        .then(({ list, resolution }) => {
          setTenantsError(false)
          if (list.length) setTenants(list)
          applyTenantResolution(resolution)
        })
        .catch(() => {
          setTenantsError(true)
          applyTenantResolution(resolveStoredTenant(null, savedTenant))
        })
    } else {
      const tenant = u?.tenant
      if (tenant) {
        setTenants([tenant])
        setActiveTenantState(tenant)
        localStorage.setItem('active_tenant', tenant.id)
      }
    }
  }, [applyTenantResolution])

  // TENANT-PICKER-FE-1: api.ts fires this once per boot on a 400 tenant_required / 404
  // tenant_not_found. For a super admin the stored bureau is gone or missing: drop it (so
  // no stale X-Tenant rides on the picker's own requests) and raise the wall. Staff never
  // see these codes (their own bureau is explicit), so for them the refusal stays an
  // ordinary failed request. The latest user is read from a ref (REFS-IN-EFFECTS-1).
  const userRef = useRef<AuthUser | null>(null)
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => {
    const onTenantRequired = () => {
      // A non-super-admin never keeps a stale pick signal, so a dropped event cannot use it up.
      if (!userIsSuperAdmin(userRef.current)) { clearTenantPickSignal(); return }
      localStorage.removeItem('active_tenant')
      setActiveTenantState(null)
      setNeedsTenantPick(true)
    }
    window.addEventListener(TENANT_REQUIRED_EVENT, onTenantRequired)
    return () => window.removeEventListener(TENANT_REQUIRED_EVENT, onTenantRequired)
  }, [])

  // Pin the tenant an auth response names (staff); for a super admin (no tenant in the
  // response) keep a STORED bureau the /tenants list still carries, else raise the picker
  // (TENANT-PICKER-FE-1, Danny 4a = A: never a first-row guess). Shared by login and
  // verifyMfa (DRY-1 r6). Never pins a hardcoded tenant when the list fails.
  const pinTenantAfterAuth = useCallback(async (tenant: Tenant | null | undefined) => {
    if (tenant?.id) {
      localStorage.setItem('active_tenant', tenant.id)
      setActiveTenantState(tenant)
      setTenants([tenant])
      setNeedsTenantPick(false)
      return
    }
    const savedTenant = localStorage.getItem('active_tenant')
    try {
      const { list, resolution } = await loadTenantResolution(savedTenant)
      if (list.length) setTenants(list)
      applyTenantResolution(resolution)
    } catch {
      applyTenantResolution(resolveStoredTenant(null, savedTenant))
    }
  }, [applyTenantResolution])

  // An /auth/me or login response that carries a tenant keeps the active bureau in sync (package +
  // modules stay fresh); a super admin's own switch is never overwritten. Stable: functional setState.
  const adoptResponseTenant = useCallback((t: Tenant) => {
    setActiveTenantState(prev => {
      // Only update if this response is for the currently active tenant
      // (super admins may have switched — don't overwrite their selection).
      if (!prev || prev.id === t.id) {
        localStorage.setItem('active_tenant', t.id)
        return t
      }
      return prev
    })
  }, [])

  // Session gone (401 elsewhere, logout): drop the bureau slice outright. Stable.
  const resetTenantState = useCallback(() => {
    setNeedsTenantPick(false)
    setActiveTenantState(null)
    setTenants([])
  }, [])

  return { tenants, tenantsError, activeTenant, needsTenantPick, setActiveTenant, setupTenants, pinTenantAfterAuth, adoptResponseTenant, resetTenantState }
}
