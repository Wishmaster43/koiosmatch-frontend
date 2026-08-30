/**
 * koiosmodels/api — the three calls behind the superadmin Koios models screen.
 * One place so every card PATCHes the same endpoint the same way (§10, §11).
 */
import api, { unwrap } from '@/lib/api'
import type { KoiosModelsAdminData, KoiosModelsAdminPatch } from './types'
import { normalizeFlavors } from './types'

const ENDPOINT = '/superadmin/koios/models'

// Every response passes through here so a stale/list-shaped `flavors` (MODELS-PERSIST-1)
// never reaches a card — only the canonical Record does.
function normalizeResponse(data: KoiosModelsAdminData): KoiosModelsAdminData {
  return { ...data, flavors: normalizeFlavors(data.flavors) }
}

// Full registry snapshot — models, flavours, catalog, packages, routing, tenants.
export async function fetchKoiosModelsAdmin(signal?: AbortSignal): Promise<KoiosModelsAdminData> {
  const res = await api.get(ENDPOINT, { signal })
  return normalizeResponse(unwrap<KoiosModelsAdminData>(res))
}

// Partial save — only the section(s) the caller actually changed. The PATCH body
// itself always carries the canonical Record (never the list shape) — callers build
// it from an already-normalized draft.
export async function patchKoiosModelsAdmin(patch: KoiosModelsAdminPatch): Promise<KoiosModelsAdminData> {
  const res = await api.patch(ENDPOINT, patch)
  return normalizeResponse(unwrap<KoiosModelsAdminData>(res))
}

// The manual "ververs" action — re-pulls the vendor model list. Never automatic
// (API-CREDITS-1 does not apply here, but the endpoint itself must stay click-only
// per the brief, so it can't fire from a mount effect or a poll).
export async function refreshKoiosModelsAdmin(): Promise<KoiosModelsAdminData> {
  const res = await api.post(`${ENDPOINT}/refresh`)
  return normalizeResponse(unwrap<KoiosModelsAdminData>(res))
}
