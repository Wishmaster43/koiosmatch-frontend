/**
 * noteLinksApi — NOTITIE-DOORLINK-1 write side: the manual koppel-picker actions on
 * ONE note (candidate or customer). POST attaches a manual link to a stamdata
 * principal, DELETE detaches a manual link only — the backend's own
 * removeManualLink() guard 404s an auto-derived row, it never silently deletes one.
 *
 * VOCABULARY (measured against the backend 04-09, NOT the customer_location/
 * customer_department/customer_contact naming an earlier plan draft assumed):
 * `NoteLinkDeriver::principalTypes()` and `ShapesNoteLinks::shapeLink()` return the
 * bare tokens candidate/customer/location/department/contact — `location` means a
 * CustomerLocation, `department` a CustomerDepartment, `contact` a CustomerContact
 * (same tokens PlanningFavorites' LinkableType and noteDraftApi's
 * NOTE_DRAFT_ENTITY_TYPES already use).
 *
 * READ SIDE (measured 04-09): CandidateNoteController::shape() and
 * CustomerNoteController's mirror carry no `links` field on GET/POST/PATCH note
 * responses — a note's links are NOT part of the note payload yet. Callers keep
 * whatever this file's add/remove calls return in their own local/optimistic
 * state until a read field lands (tracked for the backend follow-up).
 */
import api from '@/lib/api'
import type { Id } from '@/types/common'

// The note-link principal vocabulary — see the file docblock for the measured source.
export type NoteLinkPrincipalType = 'candidate' | 'customer' | 'location' | 'department' | 'contact'

// One note ↔ principal link, per ShapesNoteLinks::shapeLink. `label` is null when
// the reader lacks the principal's own view right (candidates.view / customers.view) —
// render an honest neutral chip then, never a blank one.
export interface NoteLinkItem {
  id: Id
  linkable_type: NoteLinkPrincipalType
  linkable_id: Id
  label: string | null
  is_manual: boolean
}

// The two note families this write side serves today (mirrors NoteLinkHost naming
// used across the note popout/drafts machinery).
export type NoteLinkHost = 'candidates' | 'customers'

// POST /{host}/{hostId}/notes/{noteId}/links { linkable_type, linkable_id } → 201 { data }.
// 403s server-side unless the note is the caller's own or they hold
// <host>.notes.manage_all — callers gate the affordance the same way NoteRow's
// pencil/bin already do (canManageNote), never rely on this call alone.
export function addNoteLink(host: NoteLinkHost, hostId: Id, noteId: Id, body: { linkable_type: NoteLinkPrincipalType; linkable_id: Id }): Promise<NoteLinkItem> {
  return api.post(`/${host}/${hostId}/notes/${noteId}/links`, body)
    .then(res => (res.data as { data: NoteLinkItem }).data)
}

// DELETE /{host}/{hostId}/notes/{noteId}/links/{linkId} → 204. Resolves true only
// on a landed 2xx (an auto-derived link 404s, never silently "succeeds").
export function removeNoteLink(host: NoteLinkHost, hostId: Id, noteId: Id, linkId: Id): Promise<boolean> {
  return api.delete(`/${host}/${hostId}/notes/${noteId}/links/${linkId}`).then(() => true)
}
