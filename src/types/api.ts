/**
 * Shared API-contract types.
 *
 * One place to describe the shapes the backend returns, so components stop
 * re-guessing field names (the audit flagged the lack of type-safety against the
 * contract). Import these as `import type { ... } from '../types/api'`.
 */

/** Paid add-on modules. SM endpoints are hard-gated server-side on 'sm'. */
export type ModuleKey = 'sm' | 'hf' | 'ai' | 'ats' | 'plan'

/** A role or permission can arrive as a bare string or an object with a name. */
export type Named = string | { name: string }

export interface Tenant {
  id: string
  name?: string
  /** Package tier id (e.g. 'reporting_sm', 'ats_crm_ai_planning'). */
  package?: string
  /** Explicit module list when the backend sends one; else derived from package. */
  modules?: Array<string | { key?: string; name?: string }>
  primary_color?: string
  logo_url?: string | null
}

export interface User {
  id?: number | string
  name?: string
  firstname?: string
  lastname?: string
  email?: string
  is_super_admin?: boolean
  roles?: Array<string | { name: string; permissions?: Named[] }>
  permissions?: Named[]
  mfa_enabled?: boolean
  tenant?: Tenant
  accessible_pages?: string[]
}

/** Normalised list shape returned by unwrapList() — see lib/api. */
export interface ListResult<T = unknown> {
  rows: T[]
  total: number
  page: number
  lastPage: number
  perPage: number
}

/** Laravel API-Resource envelope ({ data, meta }). */
export interface ResourceEnvelope<T = unknown> {
  data: T
  meta?: PaginationMeta
}

export interface PaginationMeta {
  total?: number
  per_page?: number
  current_page?: number
  last_page?: number
}

/** Rate-limit (429) and async-sync (202) response bodies. */
export interface RateLimitBody {
  message?: string
  retry_after?: number
}

export interface AsyncSyncBody {
  message?: string
  status?: 'queued' | string
}
