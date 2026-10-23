/**
 * tenantProvisioning — the provisioning fields BE lane F (B-002) puts on GET /tenants rows,
 * shared by useTenantSearch, TenantPickPage and TenantSwitcher (one row type, not three).
 * null/absent means ready (the seeded bureaus answer null).
 */

// Provisioning state of a bureau as served; null = ready.
export type ProvisioningStatus = 'pending' | 'ready' | 'failed' | null

// The optional provisioning fields every tenant row may carry.
export interface TenantProvisioning {
  provisioning_status?: ProvisioningStatus
  provisioning_error?: string | null
}

/** True when the bureau cannot be pinned yet (pending or failed): the API would answer 409. */
export function isTenantBlocked(status: ProvisioningStatus | undefined): status is 'pending' | 'failed' {
  return status === 'pending' || status === 'failed'
}
