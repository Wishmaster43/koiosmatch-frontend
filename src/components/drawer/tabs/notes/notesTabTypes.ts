/**
 * notesTabTypes — the NotesTab prop/data shapes, extracted out of NotesTab.tsx
 * (§3 split, K-SIZE-SPLIT-A). Re-exported from NotesTab.tsx so every existing
 * `import type { ... } from '.../NotesTab'` caller keeps working unchanged.
 */
import type { ReactNode } from 'react'
import type { NotesPopoutTarget } from '@/hooks/useNotesPopout'
import type { NoteLinkHost, NoteLinkItem } from './noteLinksApi'
import type { Id } from '@/types/common'

// Exported: NoteComposer (notes/) reads these — one shared shape, never a
// second hand-copied type for the popup.
export interface NoteType { value: string; label: string; color?: string }
// author_id (RECHTEN-DETAIL-1): the note creator's user id, present only on hosts that
// implement the rights model — undefined (key absent) vs. explicit null are DIFFERENT
// states, see NotesTab's file-header RIGHTS comment. `language` (NOTE-TAAL-1): the note's
// own spellcheck/output language, optional — null/absent = tenant default
// has_previous_version (NOTE-UNDO-FE-1, K-172): true once the note carries an
// undo slot (one previous body, filled by the update that most recently
// overwrote it) — drives the row's "restore previous version" action below.
// links (NOTITIE-DOORLINK-1 read side, K-225 H2): the note's manual + derived
// principal links — NoteRow renders only the manual ones (see that file).
export interface NoteItem { type?: string; channel?: string; title?: string; author?: string; author_name?: string; author_id?: string | number | null; created_by?: string | { name?: string }; updated_by?: string | { name?: string }; edited_by?: string; text?: string; body?: string; ago?: string; created_at?: string; updated_at?: string; language?: string; has_previous_version?: boolean; links?: NoteLinkItem[]; [k: string]: unknown }
// K-172: the previous-version peek — nulls when the note has no undo slot yet.
export interface NotePreviousVersion { previous_body: string | null; previous_saved_at: string | null }
export interface TimelineItem { time?: string; created_at?: string; text?: string; description?: string; [k: string]: unknown }
export interface NotesLabels {
  notes?: ReactNode; newNote?: ReactNode; type?: ReactNode; channel?: ReactNode; channelNone?: ReactNode; save?: string; cancel?: string; edit?: string; openChangelog?: string
  notesEmpty?: ReactNode; timeline?: ReactNode; timelineEmpty?: ReactNode
  conversations?: ReactNode; conversationsEmpty?: ReactNode
  notePlaceholder?: (typeLabel: string) => string
  // Delete affordance (RECHTEN-DETAIL-1) — icon title/aria-label + the shared
  // confirm dialog's message. A host that omits these while still passing
  // onDeleteNote gets a working button with blank copy (honest partial state,
  // never a crash) until it wires the label too.
  deleteNote?: string
  deleteConfirm?: string
  // Tooltip/aria-label for the optional "edit status event" pencil (see onEditStatusEvent below).
  editStatusEvent?: string
  // Placeholder/aria-label for the notes search box (optional — a host that omits
  // it still gets a working, just unlabelled, search input; every current host
  // supplies one via its own i18n namespace).
  searchPlaceholder?: string
  // Load-error row copy (see `error`/`onRetry` below) — the host's own "notes could
  // not be loaded" message and the shared retry-button label (hosts reuse the
  // existing `common:error.retry` key, mirrors MatchContractSection).
  loadError?: ReactNode
  retry?: ReactNode
  // Restore-previous-version affordance (NOTE-UNDO-FE-1, K-172). Icon title/
  // aria-label + the confirm dialog's title; the message itself is built here
  // from the shared `common:notes.*` keys (previous_saved_at formatting needs
  // useDateFormat, which only NotesTab has).
  restorePrevious?: string
  restoreConfirmTitle?: string
}
// NOTE-TAAL-1: `language` rides along on save/edit — optional, undefined means
// "let the backend default to the tenant language" (never force a value the
// recruiter never picked).
// NOTE-ACTION-ITEMS-1 (CMBE 173ffbf7): the wire shape the note write-path owns.
// status/created are deliberately absent — the write-path owns the DEFINITION
// only; a stale save must never reset an executed item.
export interface NoteActionItemWire {
  id?: string
  title: string
  type: string
  link?: string
  message?: string
  due_date?: string
  start?: string
  assignee_id?: string
  sort_order?: number
  // NOTE-BIRTH-STATUS-1 (api 02755adc): a NEW item (no id) may be born with the outcome the
  // wizard already reached before the note was saved — status executed|failed and the record
  // it created; the server verifies `created.id` exists in the tenant and ignores both on an
  // item that already has an id (the execute route stays the only writer there).
  status?: 'pending' | 'executed' | 'failed'
  created?: { type: 'appointment' | 'task' | 'calllist'; id: string }
}
export interface NotePayload { type: string; title: string; body: string; channel?: string; language?: string; action_items?: NoteActionItemWire[] }

// Spread helper for every note write-path: the panel travels ONLY when the composer
// produced one (present = the full wanted set, absent = leave the stored panel untouched).
export const actionItemsWire = (items?: NoteActionItemWire[]): { action_items?: NoteActionItemWire[] } =>
  (items ? { action_items: items } : {})

export interface NotesTabProps {
  // CONCEPT-NOTE-2 (K-161): when the host names its dossier, a cancelled
  // concept also persists server-side (survives refresh/another workplace) —
  // without it the concept stays session-only.
  draftEntity?: { type: import('./noteDraftApi').NoteDraftEntityType; id: string }
  notes?: NoteItem[]
  // System events (status/phase changes, BE-written) — rendered in the TIMELINE
  // section, not the notes thread (Danny 2026-07-13: events are not notes).
  systemNotes?: NoteItem[]
  timeline?: TimelineItem[]
  noteTypes?: NoteType[]
  // Full type list for CHIP resolution (composer keeps the writable-only list).
  chipTypes?: NoteType[]
  // Optional contact channels (last_contact_types). Picking one marks the note a
  // contact moment → the backend stamps last_contact_at/_type/_by. Empty = internal note.
  channels?: NoteType[]
  labels?: NotesLabels
  editorLabels?: Record<string, string>
  authorInitials?: string
  timelineName?: ReactNode
  // NOTES-TIMELINE-CONVERGE-1: no longer rendered — EventTimeline marks rows with
  // a kind icon, not an avatar (mirrors vacancies/applications Tijdlijn). Kept in
  // the prop shape so existing hosts don't need an unrelated edit.
  timelineInitials?: string
  onAddNote?: (payload: NotePayload) => void
  onEditNote?: (i: number, payload: NotePayload) => void
  // Delete a note by its index in the full `notes` array (mirrors onEditNote).
  // Omitted (every current host) → no delete button renders at all — no fake
  // affordance (§3). RECHTEN-DETAIL-1 gating (see canManageNote) applies to it
  // exactly like the edit pencil.
  onDeleteNote?: (i: number) => void
  // NOTE-UNDO-FE-1 (K-172): peek the one-slot undo (GET previous-version) and
  // execute it (POST restore-previous). Both key off the note's index in the
  // FULL `notes` array, mirroring onEditNote/onDeleteNote — the host resolves
  // the note's own id from that index the same way it already does for edit/
  // delete. Omitted (a host that hasn't wired the family's routes yet) → no
  // action renders at all, no fake affordance (§3), regardless of
  // has_previous_version on any note.
  onFetchPreviousVersion?: (i: number) => Promise<NotePreviousVersion | null>
  // Resolves true once the restore actually landed (mirrors editNote's return
  // contract) — the caller re-fetches/reconciles the note in its own family
  // shape; this tab never assumes the response shape itself.
  onRestorePreviousNote?: (i: number) => Promise<boolean>
  // Permission key checked when a note isn't the current user's own (RECHTEN-
  // DETAIL-1). Defaults to the one manage-all permission that exists today
  // (candidates); a future entity that ships its own author_id + rights model
  // overrides this per its own permission name.
  managePermission?: string
  // Optional section toggles — hosts with their own sub-tabs render one section at a time.
  showNotes?: boolean
  // Optional host-supplied row rendered at the TOP of the composer (Danny 05-08:
  // the customer tab's "link this note to …" picker belongs in the compose flow,
  // not as a standing toolbar row). Rendered only while composing a NEW note.
  composerExtra?: ReactNode
  // F5 second-screen (+ NOTITIE-POPOUT-HANDOFF-1 / -EDIT-1): which record this
  // notes surface belongs to, and which side of the glass this render is on. One
  // prop carries the whole relationship — the composer's draft handoff, the
  // per-note edit handoff and (in the window itself) receiving either all key off
  // it. Passed ONLY by a host whose entity owns a `/popout/notes/{entity}/{id}`
  // route — candidate, customer and vacancy today; applications/matches/tasks/
  // opportunities and the scoped location/department notes have no such route, so
  // they omit it and render no button at all (§3, no fake affordance). Naming the
  // target is NOT enough for the per-note button: that one also needs a window that
  // can really PATCH the note (NOTE_EDIT_POPOUT_ENTITIES). The popout pages pass it
  // with `role: 'window'`, so the second screen receives handoffs but never offers
  // to open itself again.
  popout?: NotesPopoutTarget
  // NOTITIE-DOORLINK-1 (Danny GO 28-08): opts a host into the manual koppel-picker
  // chips under each regular note — only the candidate and customer Notities tabs
  // pass this today (the two families the backend's addLink/removeLink routes
  // serve, see noteLinksApi's docblock). Omitted host → NoteRow renders nothing new.
  noteLinks?: { host: NoteLinkHost; hostId: Id }
  showTimeline?: boolean
  showConversations?: boolean
  // Optional (Danny 2026-07-20, job A "potlood op de statuswissel"): when the host
  // passes this, the "Statuswissel" system-event row gets an edit pencil that calls
  // back into the host's status-edit entry point (candidates' CommunicationTab is
  // the only current caller). Hosts that omit it — every other entity/tab — render
  // no pencil at all; zero behaviour change for them (additive prop).
  onEditStatusEvent?: () => void
  // Optional load-error state (Danny 04-08: "voeg retry toe aan de notities-tab
  // load-error" — added HERE, in the shared tab, so every host (applications,
  // vacancies, matches, tasks, …) gets the same retry affordance at once, mirroring
  // MatchContractSection's error+retry row. `error` replaces the whole tab body with
  // a calm danger row; `onRetry` adds a retry button to it. A host that passes
  // `error` without `onRetry` gets the previous static-text-only behaviour —
  // fully back-compat for any caller that hasn't wired a retry point yet.
  error?: boolean
  onRetry?: () => void
  // Optional per-item content override (MATCH-TIMELINE-EVENT-1, point 3): when it
  // returns a node for a given timeline item, that REPLACES the default text line
  // inside the row's existing dot/avatar/date wrapper — keeps this shared tab
  // entity-agnostic (the host owns the entity-specific i18n + field mapping;
  // candidates' CommunicationTab is the first/only current caller). Returning
  // null/undefined for an item falls back to the default `ev.text`/`ev.description`
  // line — zero behaviour change for every event the host doesn't recognise.
  renderTimelineContent?: (ev: TimelineItem) => ReactNode | null
}
