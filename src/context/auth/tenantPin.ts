/**
 * tenantPin — loads the bureau list and resolves the stored bureau against it (B-003).
 * The list is one page (25 by default), so a stored bureau beyond page one is looked up
 * by exact id before it is ever declared stale.
 */
import api, { unwrapList } from '@/lib/api'
import { resolveStoredTenant } from '@/lib/tenantResolution'
import type { StoredTenantRow, TenantResolution } from '@/lib/tenantResolution'

// The first page of bureaus plus the resolution of the stored id against all of them.
export interface TenantPinResult {
  list: StoredTenantRow[]
  resolution: TenantResolution
}

// Fetches /tenants, then falls back to an exact-id search when the list is paginated and misses the stored id.
export async function loadTenantResolution(savedId: string | null): Promise<TenantPinResult> {
  const res = await api.get('/tenants')
  const page = unwrapList<StoredTenantRow>(res)
  const list = Array.isArray(page.rows) ? page.rows : []
  const first = resolveStoredTenant(list, savedId)
  const truncated = page.lastPage > 1 || page.total > list.length
  if (first.kind !== 'pick' || !savedId || !truncated || list.some(t => t.id === savedId)) return { list, resolution: first }
  try {
    const found = await api.get('/tenants', { params: { search: savedId, per_page: 100 } })
    const exact = unwrapList<StoredTenantRow>(found).rows.filter(t => t.id === savedId)
    return { list, resolution: exact.length ? resolveStoredTenant(exact, savedId) : { kind: 'pick' } }
  } catch {
    // The lookup itself failed: keep the stored id, never drop a bureau we could not check.
    return { list, resolution: { kind: 'keepStored', id: savedId } }
  }
}
