/**
 * deletion — shared types for the two-step trash lifecycle (TRASH-OVERAL-2)
 * used by all seven trash-enabled entities (customers, vacancies, opportunities,
 * tasks, matches, outreach-campaigns, workflows). The routes are identical per
 * entity: GET …/deletion-preview, POST …/mark-deletion, POST …/unmark-deletion.
 */
import type { operations } from './api-generated'

// Mark request body typed FROM the generated spec (§10): the seven operations share
// one shape, so the customers entry is the canonical source — a backend rename of
// transfer_to_owner_id surfaces here as a compile error, not a runtime 422.
export type MarkDeletionBody = NonNullable<
  operations['postCustomersIdMarkDeletion']['requestBody']
>['content']['application/json']

// Lifecycle of a soft-deletable row: live, archived, or parked in the trash
// awaiting automatic erasure after the tenant's grace window.
export type DeletionLifecycle = 'active' | 'archived' | 'pending_erase'

// One relation that blocks marking; `type` is the stable token the FE translates,
// `label` is the server's NL-only fallback text (used when no translation exists).
export interface DeletionBlocker {
  type: string
  label: string
  count: number
}

// HAND-WRITTEN (§10): the generated spec documents only request bodies + the 401
// response — it carries no 2xx schema — so the preview/response shapes live here.
export interface DeletionPreview {
  blocking: DeletionBlocker[]
  // Ownership hand-over hint: which attribute can be transferred and who holds it now.
  transferable: { attribute: string; current_owner_id: string | null } | null
  can_mark: boolean
  lifecycle: DeletionLifecycle
}

// HAND-WRITTEN (§10, no 2xx schema in the spec): the mark/unmark success payload —
// only the field the FE actually consumes; the resource carries more.
export interface DeletionMarkResponse {
  lifecycle: DeletionLifecycle
  pending_erase_at?: string | null
}

// HAND-WRITTEN (§10): the 409 body of a mark attempt that lost the race — the row
// gained a blocking relation between preview and mark. Transfer was NOT applied.
export interface DeletionConflictBody {
  code: 'in_use'
  blocking: DeletionBlocker[]
}
