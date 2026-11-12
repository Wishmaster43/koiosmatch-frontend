/**
 * useBranchLinks - external-system ids (HelloFlex / Shiftmanager) of the visible
 * branches. Reads GET /external-id-mappings per branch through react-query and saves
 * through PUT /external-id-mappings; fetches nothing while disabled (no connector module
 * or no settings.update permission, the BE reads a branch mapping with that permission).
 * Exposes loading and error flags so the screen never shows a failed read as "unlinked".
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { operations } from '@/types/api-generated'

// Request body typed from the generated spec; the response shape below is hand-written
// because the spec carries no 2xx schema for putExternalIdMappings.
type PutBody = operations['putExternalIdMappings']['requestBody']['content']['application/json']

export type LinkSystem = 'hf' | 'sm'
export interface BranchLink { id: string | null; status: 'linked' | 'failed' | 'unlinked' | null; error: string | null }
export type BranchLinks = Record<LinkSystem, BranchLink>

const EMPTY: BranchLink = { id: null, status: null, error: null }

// Map the wide mapping row to the two per-system faces (null ids when no mapping exists).
function toLinks(row: Record<string, unknown> | undefined): BranchLinks {
  const face = (sys: LinkSystem): BranchLink => ({
    id: (row?.[`${sys}_id`] as string | null | undefined) ?? null,
    status: (row?.[`${sys}_status`] as BranchLink['status'] | undefined) ?? null,
    error: (row?.[`${sys}_error`] as string | null | undefined) ?? null,
  })
  return { hf: face('hf'), sm: face('sm') }
}

// Unwrap the mapping row from an axios response ({data: row} or the bare row).
function rowOf(res: { data?: unknown } | undefined): Record<string, unknown> | undefined {
  const body = res?.data as { data?: Record<string, unknown> } | Record<string, unknown> | undefined
  return (body && 'data' in body ? body.data : body) as Record<string, unknown> | undefined
}

// Fetch every visible branch's mapping row via the query string (the BE reads the query).
async function fetchAll(ids: string[], signal?: AbortSignal): Promise<Record<string, BranchLinks>> {
  const pairs = await Promise.all(ids.map(async (id) => {
    const res = await api.get('/external-id-mappings', { params: { entity_type: 'branch', entity_id: id }, signal })
    return [id, toLinks(rowOf(res))] as const
  }))
  return Object.fromEntries(pairs)
}

export function useBranchLinks(ids: string[], enabled: boolean) {
  const qc = useQueryClient()
  // Stable key for the id list so a fresh array each render does not refetch.
  const idsKey = ids.join(',')
  const query = useQuery({ queryKey: ['branch-links', idsKey], queryFn: ({ signal }) => fetchAll(ids, signal), enabled: enabled && ids.length > 0 })
  const links = query.data

  // Save one system's id (null unlinks). The state comes from the PUT response (the wide
  // mapping object) so no second read can make a saved value look failed.
  const save = useCallback(async (entityId: string, system: LinkSystem, value: string | null) => {
    const body = { entity_type: 'branch', entity_id: entityId, [`${system}_id`]: value } as PutBody
    const res = await api.put('/external-id-mappings', body)
    const row = rowOf(res)
    if (row && `${system}_id` in row) {
      qc.setQueryData<Record<string, BranchLinks>>(['branch-links', idsKey], (prev) => ({ ...(prev ?? {}), [entityId]: toLinks(row) }))
      return
    }
    // A response without the row (not the documented wide shape) re-reads this page instead of guessing.
    await qc.invalidateQueries({ queryKey: ['branch-links', idsKey] })
  }, [qc, idsKey])

  const get = useCallback((id: string): BranchLinks => links?.[id] ?? { hf: EMPTY, sm: EMPTY }, [links])
  return { get, save, loading: query.isLoading, error: query.isError }
}
