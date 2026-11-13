/**
 * linksApi — typed client for the integration link table (MAPPING-TABLE-FE-1):
 * which Koios record is linked to which external id in HelloFlex / Shiftmanager.
 * The PUT body and the GET /integrations/links query are typed from the generated spec
 * (putExternalIdMappings, getIntegrationsLinks; BE 568ecf81e); the 2xx response shapes are
 * hand-written against the CMBE contract (the spec carries no 2xx schema).
 */
import api, { unwrapList } from '@/lib/api'
import type { operations } from '@/types/api-generated'

// Request body of PUT /external-id-mappings and the GET /integrations/links query, straight from the generated spec.
type PutLinkBody = operations['putExternalIdMappings']['requestBody']['content']['application/json']
type ListLinksQuery = NonNullable<operations['getIntegrationsLinks']['parameters']['query']>

// Record kinds the link table can hold (branch | user | cost_center follow later).
export type LinkEntityType = PutLinkBody['entity_type']

// The two external systems a link can point to.
export type LinkSystem = 'helloflex' | 'shiftmanager'

// Stored status as the API returns it (null when nothing is stored); 'unlinked' is DERIVED from a blank external_id.
export type LinkStatus = 'pending' | 'syncing' | 'linked' | 'failed' | null

// One link row as the list endpoint returns it.
export interface LinkRow {
  entity_type: LinkEntityType
  entity_id: string
  // A null label is the deleted signal (the API never sends a `deleted` flag).
  label: string | null
  system: LinkSystem
  external_id: string | null
  status: LinkStatus
  error: string | null
  synced_at: string | null
  linked_at: string | null
  linked_by: string | null
  linked_by_name: string | null
  updated_at: string | null
}

// Query params of GET /integrations/links; system is preset by the connector tab.
export interface ListLinksParams {
  system: LinkSystem
  entityTypes?: LinkEntityType[]
  status?: 'pending' | 'syncing' | 'linked' | 'failed' | 'unlinked'
  search?: string
  page?: number
  perPage?: number
}

// One page of rows plus the pagination meta.
export interface LinksPage {
  rows: LinkRow[]
  total: number
  page: number
  lastPage: number
  perPage: number
}

// List links: empty params are omitted (unknown/blank params would 422 or filter wrongly).
export async function listLinks(p: ListLinksParams, signal?: AbortSignal): Promise<LinksPage> {
  const params: ListLinksQuery = { system: p.system }
  if (p.entityTypes?.length) params.entity_type = p.entityTypes
  if (p.status) params.status = p.status
  if (p.search) params.search = p.search.slice(0, 100) // contract: at most 100 chars, longer would 422
  if (p.page) params.page = p.page
  if (p.perPage) params.per_page = p.perPage
  const res = await api.get('/integrations/links', { params, signal })
  const list = unwrapList<LinkRow>(res)
  return { rows: list.rows, total: list.total, page: list.page, lastPage: list.lastPage, perPage: list.perPage }
}

// Set or clear one link: hf_id for HelloFlex, sm_id for Shiftmanager; null clears.
export async function putLink(body: {
  entity_type: LinkEntityType; entity_id: string; system: LinkSystem; external_id: string | null
}): Promise<void> {
  const idKey = body.system === 'helloflex' ? 'hf_id' : 'sm_id'
  await api.put('/external-id-mappings', {
    entity_type: body.entity_type, entity_id: body.entity_id, [idKey]: body.external_id,
  })
}
