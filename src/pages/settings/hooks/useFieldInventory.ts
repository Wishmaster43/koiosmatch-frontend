/**
 * useFieldInventory — the ONE React Query wrapper around
 * `GET /settings/field-inventory?entity=<entity>` (VERPLICHTE-VELDEN-INVENTARIS-1,
 * CONTRACT-CHANGELOG 17-09). This is the intended single source for the required-fields
 * screens and the backend's write-time 422. As of FIELDS-2-FE-1/2 (17-09) the candidate
 * and customer screens are wired onto this hook, with their catalogues folded down to
 * `key -> labelKey` maps; the application screen's adoption is tracked follow-up work,
 * not done here.
 *
 * The generated `operations['getSettingsFieldInventory']` types the query as a JSON
 * request body (an openapi-typescript quirk for a GET route documented with query
 * params) and carries no 2xx response schema — both request and response shapes
 * below are hand-written from the changelog entry, per CLAUDE.md §10.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

/** The six entities the endpoint currently serves. */
export type FieldInventoryEntity =
  | 'candidate' | 'customer' | 'customer_contact' | 'customer_location' | 'customer_department' | 'application'

/** One field-inventory group heading (candidate ships 8, the rest ship one `general`). */
export interface FieldInventoryGroup {
  key: string
  label_key: string
}

/** One field-inventory row — hand-written response shape (no 2xx schema in the spec). */
export interface FieldInventoryField {
  key: string
  group: string
  type: string
  requirable: boolean
  creatable: boolean
  writable: boolean
  internal_name: string
  external_name: string | null
  aliases: string[]
  requires_permission: string | null
  /** Present whenever `requirable` is false — consent / financial / relation / webhook-stamped. */
  reason: string | null
}

export interface FieldInventoryResponse {
  entity: FieldInventoryEntity
  groups: FieldInventoryGroup[]
  fields: FieldInventoryField[]
}

export const fieldInventoryQueryKey = (entity: FieldInventoryEntity) => ['settings', 'field-inventory', entity]

// Fetch one entity's field inventory: {data:{entity, groups, fields}}.
const fetchFieldInventory = (entity: FieldInventoryEntity) =>
  api.get('/settings/field-inventory', { params: { entity } }).then(unwrap) as Promise<FieldInventoryResponse>

// The live catalogue for one entity, with loading/error state a screen renders honestly (§3 four states).
export function useFieldInventory(entity: FieldInventoryEntity) {
  const query = useQuery({
    queryKey: fieldInventoryQueryKey(entity),
    queryFn: () => fetchFieldInventory(entity),
    staleTime: 5 * 60 * 1000,
  })

  return {
    groups: query.data?.groups ?? [],
    fields: query.data?.fields ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
