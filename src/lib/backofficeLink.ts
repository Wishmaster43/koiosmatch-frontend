/**
 * backofficeLinkOf — resolve ONE system's entry out of a flat `backoffice_links[]`
 * array (KOPPELINGEN-META-1). Shared by every entity that carries the relation —
 * candidates, customers, locations, departments, contacts, matches (EXTRACT-1) —
 * since all of them link through the same generic sync endpoint
 * (POST /sync/{entity}/{id} { system }). Returns null when the tenant never
 * attempted that system (the backend omits a system nobody ever tried, see
 * ExternalIdMapping::toBackofficeLinks).
 */
import type { Id } from '@/types/common'

/** Raw API shape of one backoffice_links[] element (snake_case, as the backend sends it). */
export interface ApiBackofficeLink {
  system?: string
  status?: string | null
  external_id?: string | null
  last_error?: string | null
  last_synced_at?: string | null
  linked_at?: string | null
  linked_by?: { id?: Id; name?: string | null } | null
}

/** A resolved backoffice link for ONE system: current sync state plus who/when it was FIRST linked. */
export interface BackofficeLink {
  status: string | null
  externalId: string | null
  lastError: string | null
  lastSyncedAt: string | null
  linkedAt: string | null
  linkedBy: { id: Id; name: string | null } | null
}

// Find the one entry matching `system` and normalise it to the flat UI shape; null when absent.
export function backofficeLinkOf(links: ApiBackofficeLink[] | undefined | null, system: string): BackofficeLink | null {
  const l = (links ?? []).find(x => x?.system === system)
  if (!l) return null
  return {
    status:       l.status ?? null,
    externalId:   l.external_id ?? null,
    lastError:    l.last_error ?? null,
    lastSyncedAt: l.last_synced_at ?? null,
    linkedAt:     l.linked_at ?? null,
    linkedBy:     l.linked_by ? { id: l.linked_by.id ?? '', name: l.linked_by.name ?? null } : null,
  }
}
