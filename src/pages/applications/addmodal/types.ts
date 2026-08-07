/**
 * Shared picker types for the Add Application modal's extracted pieces
 * (SearchPickField / useSearchOptions) — one source instead of each file
 * re-declaring its own copy of the same shape (§11).
 */
import type { Id } from '@/types/common'

// One picked candidate/vacancy option — ownerId/ownerName (APP-OWNER-1) ride
// along so the container's owner-derivation chain can read them straight off
// the picked option, no extra fetch for either the candidate or vacancy.
export interface PickOption { value: Id; label: string; client?: string; ownerId?: Id; ownerName?: string }

// The generic /candidates + /vacancies row shape (only the fields either mapper
// reads; the other entity's own fields simply stay undefined — same tolerant
// read the rest of this modal already relies on for API rows).
export interface RawPickRow {
  id?: Id; name?: string; first_name?: string; last_name?: string
  title?: string; titel?: string; client_name?: string; client?: string
  owner?: { id?: Id; name?: string } | null
}
