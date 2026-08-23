/**
 * koiosmodels/types — hand-typed contract for KOIOS-MODEL-ADMIN-FE-1 (CMBE K-147
 * L1+L2). The generated OpenAPI spec does not carry these superadmin shapes yet
 * (§10: type what the spec gives you, hand-write the rest) — this file is the one
 * place both the fetch and the four cards import from, so a future contract change
 * touches one file instead of four.
 */

// The three tenant-facing stands — mirrors lib/koiosModelTiers' ModelTierKey.
export type FlavorKey = 'snel' | 'slim' | 'max'

// One selectable vendor model, as the platform whitelist reports it.
export interface KoiosModelInfo {
  id: string
  display_name: string
  max_input_tokens?: number
  capabilities?: string[]
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
}

// PATCH accepts any subset of the four top-level sections — each card saves
// only the section it owns, never the whole document (avoids clobbering a
// concurrent edit from another card/tab).
export type KoiosModelsAdminPatch = Partial<
  Pick<KoiosModelsAdminData, 'flavors' | 'packages' | 'routing' | 'tenants'>
>

export const FLAVOR_KEYS: FlavorKey[] = ['snel', 'slim', 'max']
export const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max']
export const REQUEST_TYPES: KoiosRequestType[] = ['note_assist', 'generate', 'conversation_assist', 'report_advice']
