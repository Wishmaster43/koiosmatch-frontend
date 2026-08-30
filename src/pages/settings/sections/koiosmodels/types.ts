/**
 * koiosmodels/types — hand-typed contract for KOIOS-MODEL-ADMIN-FE-1 (CMBE K-147
 * L1+L2). The generated OpenAPI spec does not carry these superadmin shapes yet
 * (§10: type what the spec gives you, hand-write the rest) — this file is the one
 * place both the fetch and the four cards import from, so a future contract change
 * touches one file instead of four.
 */

// The three tenant-facing stands — mirrors lib/koiosModelTiers' ModelTierKey.
export type FlavorKey = 'snel' | 'slim' | 'max'

// One selectable vendor model, as the platform whitelist reports it. MODELS-PERSIST-1
// (CMBE): the live Models API returns dated vendor ids and models with no catalogue
// price, so each entry now also carries its own catalogue identity + offerability —
// `catalog_id` is what a flavour must be pinned to (null when the vendor id has no
// catalogue price yet), and `linkable` says whether this entry may be offered at all.
export interface KoiosModelInfo {
  id: string
  display_name: string
  max_input_tokens?: number
  capabilities?: string[]
  catalog_id: string | null
  linkable: boolean
}

// Per-model platform facts: whether it accepts an effort knob, plus whatever
// price fields the backend attaches (kept loose — pricing shape is still moving).
export interface KoiosCatalogEntry {
  supports_effort: boolean
  input_price_per_1m?: number
  output_price_per_1m?: number
  [key: string]: unknown
}

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// The four request types the routing card configures. Chat is deliberately
// absent — it follows the tenant's own flavour choice, never a platform route.
export type KoiosRequestType = 'note_assist' | 'generate' | 'conversation_assist' | 'report_advice'

export interface KoiosRoutingEntry {
  flavor: FlavorKey
  effort: EffortLevel | null
}

export interface KoiosPackageEntry {
  allowed_flavors: FlavorKey[]
  max_effort: EffortLevel
}

export interface KoiosTenantOverride {
  allowed_flavors: FlavorKey[] | null
  min_flavor: FlavorKey | null
}

export interface KoiosModelsAdminData {
  available: KoiosModelInfo[]
  flavors: Record<FlavorKey, string>
  catalog: Record<string, KoiosCatalogEntry>
  packages: Record<string, KoiosPackageEntry>
  routing: Record<KoiosRequestType, KoiosRoutingEntry>
  tenants: Record<string, KoiosTenantOverride>
  // Where `available` came from — a fresh vendor pull, or the platform's own
  // catalogue when nobody has ever refreshed yet. Drives the source line under
  // the screen title (MODELS-PERSIST-1); `available` itself is never empty.
  available_source: 'live' | 'catalog'
  refreshed_at: string | null
}

// The shape a stale response (or the exact runtime payload CMBE measured) can still
// carry for `flavors`: the LIST the GET endpoint used to return, one row per stand.
// PATCH always expects the Record below — this is only ever an INPUT shape.
export interface KoiosFlavorListRow {
  key: FlavorKey
  model_id: string
  [k: string]: unknown
}

// PATCH accepts any subset of the four top-level sections — each card saves
// only the section it owns, never the whole document (avoids clobbering a
// concurrent edit from another card/tab).
export type KoiosModelsAdminPatch = Partial<
  Pick<KoiosModelsAdminData, 'flavors' | 'packages' | 'routing' | 'tenants'>
>

// Normalises whatever shape `flavors` arrives in — the canonical Record the four
// cards and the PATCH body expect, or the list-of-rows shape measured arriving from
// a GET/refresh response (MODELS-PERSIST-1: the card used to PATCH back whichever
// shape it was handed, and the list shape fails the backend's string validation).
// Applied to every fetch/refresh/patch response so nothing downstream ever sees the
// list shape.
export function normalizeFlavors(input: unknown): Record<FlavorKey, string> {
  if (Array.isArray(input)) {
    const out = {} as Record<FlavorKey, string>
    for (const row of input as KoiosFlavorListRow[]) {
      if (row && typeof row === 'object' && typeof row.key === 'string') {
        out[row.key] = row.model_id ?? ''
      }
    }
    return out
  }
  return { ...(input as Record<FlavorKey, string>) }
}

export const FLAVOR_KEYS: FlavorKey[] = ['snel', 'slim', 'max']
export const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max']
export const REQUEST_TYPES: KoiosRequestType[] = ['note_assist', 'generate', 'conversation_assist', 'report_advice']
