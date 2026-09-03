/**
 * linkedNoteApi — K-288: writing to and popping out ONE linked-notes-feed item
 * from the LinkedNotesTab subtab. A feed item never edits itself — it PATCHes/
 * PUTs the note at its SOURCE family's own notes route (`/{base}/{id}/notes/
 * {noteId}`), the same route each family's own notes tab already uses.
 *
 * METHOD + BODY measured against the backend routes directly (CMBE, 04-09 —
 * supersedes an earlier PATCH-except-opportunity assumption): candidate/
 * customer/application register PATCH, match/opportunity/vacancy/task register
 * PUT only. The body is always `{ body, type? }` — `body` is `required` on
 * application/opportunity/task updates and `sometimes` elsewhere, so sending it
 * unconditionally succeeds everywhere; `type` rides along only when the item
 * actually carries one, and `title` only for an application source whose feed
 * item already has a (bundle H) title — every other family drops it entirely
 * rather than sending an empty/undefined value the controller would reject.
 */
import api from '@/lib/api'
import { openNoteEditPopout, type PopoutEntity } from '@/lib/secondScreen'
import type { NoteFeedItem } from '@/hooks/useNoteFeed'

// source.type → the family's own notes route + HTTP verb (measured, see docblock above).
const LINKED_NOTE_ROUTE: Record<string, { base: string; method: 'patch' | 'put' }> = {
  candidate: { base: '/candidates', method: 'patch' },
  customer: { base: '/customers', method: 'patch' },
  application: { base: '/applications', method: 'patch' },
  match: { base: '/matches', method: 'put' },
  opportunity: { base: '/opportunities', method: 'put' },
  vacancy: { base: '/vacancies', method: 'put' },
  task: { base: '/tasks', method: 'put' },
}

// Every source family that also has a working second-screen note-edit popout
// route (NoteEditPopout.tsx's own dispatch) — mirrors LINKED_NOTE_ROUTE's keys
// today, kept as its own set so the two lists can diverge honestly later.
const POPOUT_ENTITIES = new Set<string>(Object.keys(LINKED_NOTE_ROUTE))

// Builds the update body: body always, type only when set, title only for an
// application source that already carries one (bundle H, application-only for now).
function buildLinkedNoteBody(item: NoteFeedItem, newBody: string): Record<string, unknown> {
  const body: Record<string, unknown> = { body: newBody }
  if (item.type) body.type = item.type
  if (item.source.type === 'application' && typeof item.title === 'string') body.title = item.title
  return body
}

// PATCHes/PUTs one linked note at its source. Resolves true ONLY on a landed
// write (mirrors useEntityNotes' editNote "honest signal" — never true before
// the request actually succeeds), false on a missing route/id or a server error.
export async function patchLinkedNote(item: NoteFeedItem, newBody: string): Promise<boolean> {
  const route = LINKED_NOTE_ROUTE[item.source.type]
  if (!route || item.source.id == null) return false
  const call = route.method === 'put' ? api.put : api.patch
  return call(`${route.base}/${item.source.id}/notes/${item.id}`, buildLinkedNoteBody(item, newBody))
    .then(() => true)
    .catch(() => false)
}

// The second-screen pop-out URL for one feed item, or null when its source
// family has no note-edit popout route — the gate LinkedNoteRow uses before
// offering the affordance at all (§3, no fake affordance).
export function linkedNotePopoutUrl(item: NoteFeedItem): string | null {
  const { type, id } = item.source
  if (!POPOUT_ENTITIES.has(type) || id == null) return null
  return `/popout/notes/${type}/${id}/${item.id}`
}

// Actually opens the pop-out window, reusing the shared window.open helper/
// naming convention (openNoteEditPopout) so re-opening the same note refocuses
// the same OS window instead of spawning a duplicate — never a forked helper.
export function openLinkedNotePopout(item: NoteFeedItem): Window | null {
  if (linkedNotePopoutUrl(item) == null || item.source.id == null) return null
  return openNoteEditPopout(item.source.type as PopoutEntity, item.source.id, String(item.id))
}
