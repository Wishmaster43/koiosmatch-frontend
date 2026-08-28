/**
 * NotesTab — generic communication tab: notes (with a rich-text composer) +
 * timeline + conversations. Entity-agnostic; data + labels via props so it works
 * for candidates, customers, vacancies, tasks alike.
 *
 * SEARCH (Danny 03-08: "bij notities wil ik ook een zoekbalk hebben") — added
 * HERE, in the shared component, so every host (candidates, customers,
 * opportunities, applications) gets it at once. Narrows on the note body TEXT
 * (HTML stripped first — this is a rich-text field, a raw substring match would
 * false-positive/negative on markup) and the author name, entirely client-side
 * over the `notes` prop. NOT a server-side search: this component receives its
 * host's already-loaded `notes` array as-is — if a host ever paginates that list
 * server-side, this search only ever narrows what is ALREADY loaded, same as
 * every other client-side list filter in this app.
 *
 * RIGHTS (Danny 06-08, RECHTEN-DETAIL-1 "notitie-eigenaarschap") — also added
 * HERE: edit/delete on a regular note render ONLY when the logged-in user IS the
 * author (`note.author_id`) or holds `managePermission` (defaults to
 * 'candidates.notes.manage_all', the only entity with this rights model today).
 * A note whose host doesn't send `author_id` at all (matches/tasks/vacancies/
 * opportunities — not yet migrated) keeps the previous unrestricted behaviour:
 * `undefined` is NOT the same as an explicit `null` (a legacy note, pre-migration,
 * which is not self-claimable and needs managePermission like a colleague's note).
 * System notes never get these buttons regardless — see systemRow, which never
 * renders them.
 *
 * POPUP-SLEEP-1 / NOTE-ASSIST-1 / NOTE-TAAL-1 (Danny 06-08 "geen popup, geen
 * spellingchecker, geen vak voor de Koios AI verbeteringen"): the add/edit
 * composer moved out of this file into `notes/NoteComposer.tsx` — a FloatingPanel
 * popup (draggable/resizable) carrying the type/channel pickers, the RichText
 * editor (language picker + native spellcheck, TAAL-SPELL-1), and the Koios AI
 * assist section (`notes/NoteAssistSection.tsx`). This file keeps owning WHICH
 * note is being composed (`adding`/`editingIdx`) and the save/delete wiring —
 * everything about HOW the composer looks/behaves lives in `notes/`.
 *
 * NOTE-FILTERS-1 / NOTES-DOC-FILTER-MENU-1 (Danny 08-08): the type + contact-
 * channel filters next to the search box moved BEHIND the shared
 * `DrawerFilterMenu` ("toolbar leest te druk" — two inline dropdowns read as
 * clutter next to search + add). The toolbar is back to search + add + one
 * compact Filter button; the dropdowns themselves are unchanged (still the house
 * searchable SelectMenu), only where they live changed.
 *
 * NOTITIE-POPOUT-HANDOFF-1 (Danny 09/10-08 "werking hetzelfde als icon
 * profieltekst"): popping out from the COMPOSER moves the half-typed note along
 * instead of leaving the recruiter with an empty sheet on the second screen. This
 * tab owns the two ends of that handoff — it hands the composer's draft over and
 * closes the composer ONLY on the receiving window's ack, and, when it IS that
 * window, it opens its own composer on the incoming draft and acks it. The
 * protocol itself lives in `hooks/useNotesPopout` (§3 logic-in-hooks).
 *
 * NOTITIE-POPOUT-EDIT-1 (Danny 10-08: "icon moet onder change en prullenbakje
 * komen … en direct edit pop-out"): the second-screen icon that used to sit in the
 * TOOLBAR (next to Filter) is gone — it only ever opened the thread, never an
 * editor, which is exactly what Danny reported. Every note now carries the icon in
 * its OWN header row, third after the pencil and the bin and styled identically,
 * and clicking it opens the second screen with THAT note already in the composer.
 * Only the note's ID travels (see the hook): the window resolves it against the
 * thread it loaded itself and routes the save to that exact record, so the handoff
 * can never produce a duplicate note. It renders only where the receiving window
 * can really PATCH a note (`canHandOffNote` → NOTE_EDIT_POPOUT_ENTITIES: candidate
 * today; the customer/vacancy popouts wire add-only, so no button there) and only
 * where this user may edit the note here as well (same gate as the pencil).
 */
import { NOTES_THREAD_POPOUT_ENTITIES } from '@/lib/secondScreen'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { History, Search } from 'lucide-react'
import EventTimeline from '@/components/ui/EventTimeline'
import SafeHtml from '@/components/ui/SafeHtml'
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import type { NotesPopoutTarget } from '@/hooks/useNotesPopout'
import { useDateFormat } from '@/lib/datetime'
import Button from '@/components/ui/Button'
import NoteComposer from './notes/NoteComposer'
import type { NoteDraft } from '@/hooks/useNotesPopout'
import { getNoteDraft, putNoteDraft, deleteNoteDraft } from './notes/noteDraftApi'
import { useNoteRestorePrevious } from './notes/useNoteRestorePrevious'
import { useNotesPopoutHandoff } from './notes/useNotesPopoutHandoff'
import { renderSystemRow, useMergedTimelineEvents } from './notes/notesTimeline'
import NoteRow from './notes/NoteRow'
// Rights + system-note rule — the SAME module the per-note popout window applies
// (noteRights, §11: one rule, two surfaces — they must never disagree).
import { canManageNote as canManageNoteRule, isSystemNote } from './notes/noteRights'

// Strip tags for search matching only (display still goes through SafeHtml) —
// a raw substring match against the stored HTML would miss/false-match on markup.
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ')

// A note's stable id — the only thing an edit handoff carries across windows
// (NOTITIE-POPOUT-EDIT-1). Module scope: it closes over nothing, and the receiving
// effects below would otherwise re-run on every render. A local/optimistic note
// without an id cannot be pointed at from another window, so it gets no button.
const noteIdOf = (n: NoteItem) => (typeof n.id === 'string' || typeof n.id === 'number') ? String(n.id) : null

// Exported: NoteComposer (notes/) reads these — one shared shape, never a
// second hand-copied type for the popup.
export interface NoteType { value: string; label: string; color?: string }
// author_id (RECHTEN-DETAIL-1): the note creator's user id, present only on hosts that
// implement the rights model — undefined (key absent) vs. explicit null are DIFFERENT
// states, see the RIGHTS comment above. `language` (NOTE-TAAL-1): the note's own
// spellcheck/output language, optional — null/absent = tenant default
// has_previous_version (NOTE-UNDO-FE-1, K-172): true once the note carries an
// undo slot (one previous body, filled by the update that most recently
// overwrote it) — drives the row's "restore previous version" action below.
export interface NoteItem { type?: string; channel?: string; title?: string; author?: string; author_name?: string; author_id?: string | number | null; created_by?: string | { name?: string }; updated_by?: string | { name?: string }; edited_by?: string; text?: string; body?: string; ago?: string; created_at?: string; updated_at?: string; language?: string; has_previous_version?: boolean; [k: string]: unknown }
// K-172: the previous-version peek — nulls when the note has no undo slot yet.
export interface NotePreviousVersion { previous_body: string | null; previous_saved_at: string | null }
interface TimelineItem { time?: string; created_at?: string; text?: string; description?: string; [k: string]: unknown }
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
  // useDateFormat, which only this component has).
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
}
export interface NotePayload { type: string; title: string; body: string; channel?: string; language?: string; action_items?: NoteActionItemWire[] }

interface NotesTabProps {
  // CONCEPT-NOTE-2 (K-161): when the host names its dossier, a cancelled
  // concept also persists server-side (survives refresh/another workplace) —
  // without it the concept stays session-only.
  draftEntity?: { type: import('./notes/noteDraftApi').NoteDraftEntityType; id: string }
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

// Entity-agnostic notes/timeline/conversations tab; all entity-specific labels and data arrive via props (see file header).
export default function NotesTab({
  draftEntity,
  notes = [], systemNotes = [], timeline = [], noteTypes = [], chipTypes, channels = [], labels = {}, editorLabels,
  authorInitials, timelineName, onAddNote, onEditNote, onDeleteNote,
  onFetchPreviousVersion, onRestorePreviousNote,
  managePermission = 'candidates.notes.manage_all',
  showNotes = true, showTimeline = true, showConversations = true, onEditStatusEvent, renderTimelineContent,
  error, onRetry, composerExtra, popout,
}: NotesTabProps) {
  // Shared meta copy (edited-by) — common namespace so every host gets it at once.
  const { t } = useTranslation('common')
  // POPUP-SLEEP-1: this file only tracks WHICH note is being composed — the
  // composer's own fields (type/channel/title/body/language) now live inside
  // NoteComposer (notes/), mounted fresh per open so they always start from the
  // right note (see that file's docblock).
  const [adding, setAdding]   = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)   // null = new; index = editing
  // Notes search (Danny 03-08) — client-side over the already-loaded `notes` prop.
  const [search, setSearch] = useState('')
  // NOTE-FILTERS-1 (Danny 08-08): filter by note TYPE and CONTACT CHANNEL next to
  // the search box — both through the house searchable dropdown. Lives in the
  // SHARED tab, so every entity's notes get it at once ('' = all).
  const [typeFilter, setTypeFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const { formatDateTime } = useDateFormat()
  // Rights model (RECHTEN-DETAIL-1): current user id + the UI-gate permission check
  // (never security — the BE re-checks). Null-safe: a host with no AuthProvider in
  // its render tree (existing tests, hosts that haven't migrated) still works —
  // hasPermission just always says no, matching the pre-existing GeocodeButton pattern.
  const auth = useAuth()
  const currentUserId = auth?.user?.id
  const hasPermission = auth?.hasPermission ?? (() => false)
  // Delete goes through the shared confirm dialog, never a native window.confirm() (§0).
  const { confirm, dialog } = useConfirm()
  // Second screen (NOTITIE-POPOUT-HANDOFF-1 / -EDIT-1): the whole handoff
  // protocol (draft handoff, per-note edit handoff, and this-window-is-the-
  // receiver wiring) is pulled out into its own hook — see that file (§3).
  const { isPopoutWindow, handOff, handoffPending, incomingDraft, clearIncoming, canPopOutNote, openNoteWindow } =
    useNotesPopoutHandoff({ popout, notes, adding, editingIdx, setAdding, setEditingIdx, onEditNote, noteIdOf })

  // Note timestamp: real date+time when the note carries one, else the relative "ago".
  const noteWhen = (n: NoteItem) => n.created_at
    ? formatDateTime(n.created_at as string)
    : n.ago
  // Note author ("by whom"): the note's own author, from any of the API shapes.
  const noteAuthor = (n: NoteItem) =>
    (typeof n.created_by === 'object' ? n.created_by?.name : n.created_by) ?? n.author_name ?? n.author ?? ''
  // Editor ("edited by") — shown only once the backend logs it (NOTES-2b); graceful until then.
  const noteEditor = (n: NoteItem) =>
    (typeof n.updated_by === 'object' ? n.updated_by?.name : n.updated_by) ?? n.edited_by ?? ''
  const noteEdited = (n: NoteItem) => Boolean(noteEditor(n) && n.updated_at && n.updated_at !== n.created_at)
  // Ownership gate (RECHTEN-DETAIL-1) — the shared noteRights rule, bound to this
  // host's user/permission (see noteRights for the undefined-vs-null distinction).
  const canManageNote = (n: NoteItem) => canManageNoteRule(n, currentUserId, hasPermission, managePermission)
  // Per-note second-screen affordance (NOTITIE-POPOUT-EDIT-1): only where the
  // receiving window can actually PATCH the note (canHandOffNote) AND this surface
  // edits notes at all — the icon sits in the pencil's group and must never promise
  // more than the pencil does. Both canPopOutNote/openNoteWindow now come from
  // useNotesPopoutHandoff above.
  // Search narrows on body text (HTML stripped) + author name. The original index
  // is kept alongside each note (not just filtered away) because openEdit/
  // onEditNote key off a note's position in the FULL `notes` array, not the
  // filtered view — mirrors the DRILL-PAGER convention used elsewhere.
  const q = search.trim().toLowerCase()
  const visibleNotes = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => !q || stripHtml(String(n.text ?? n.body ?? '')).toLowerCase().includes(q) || String(noteAuthor(n)).toLowerCase().includes(q))
    .filter(({ n }) => !typeFilter || String(n.type ?? '') === typeFilter)
    .filter(({ n }) => !channelFilter || String(n.channel ?? '') === channelFilter)
  // System notes (backend-written status/phase changes) render as a calm event row —
  // no avatar, no edit pencil, just the "Statuswissel" chip + who/when (N-1-FE).
  // (isSystemNote now imports from noteRights — same rule as the popout window.)

  // NOTE-FILTERS-1 (Danny 08-08): type + contact-channel rows for the shared
  // DrawerFilterMenu — each only exists once the host actually offers that
  // vocabulary, so an entity without channels never gets a dead filter row.
  // Field labels reuse the SAME `labels.type`/`labels.channel` the composer
  // already shows above its own type/channel pickers — one label, two places.
  const filterRows: DrawerFilterConfig[] = []
  if ((chipTypes ?? noteTypes).length > 0) {
    filterRows.push({
      type: 'single', key: 'type', label: labels.type, value: typeFilter, onChange: setTypeFilter,
      allLabel: t('notes.allTypes', { defaultValue: 'Alle types' }),
      options: (chipTypes ?? noteTypes).map(nt => ({ value: String(nt.value), label: String(nt.label ?? nt.value) })),
    })
  }
  if (channels.length > 0) {
    filterRows.push({
      type: 'single', key: 'channel', label: labels.channel, value: channelFilter, onChange: setChannelFilter,
      allLabel: t('notes.allChannels', { defaultValue: 'Alle kanalen' }),
      options: channels.map(ch => ({ value: String(ch.value), label: String(ch.label ?? ch.value) })),
    })
  }

  // Close the popup — NoteComposer owns its own field state, so this is just "not
  // composing anything" again (mirrors the previous reset(), minus the field resets).
  // Dropping a received draft too, so a next note never re-seeds from it.
  const closeComposer = () => { setAdding(false); setEditingIdx(null); clearIncoming() }
  // CONCEPT-NOTE-1 (Danny 24-08: "wegklikken en de tekst is weg is niet goed —
  // als concept opslaan"): a cancelled NEW note survives as a session concept
  // and seeds the next new-note open; a successful save clears it. Session
  // scope is deliberate — note text is special-category data (§8), so it never
  // touches localStorage; durable concepts are the CMBE follow-up.
  const [concept, setConcept] = useState<NoteDraft | null>(null)
  // Durable layer on top of the session concept (K-161): load once per dossier;
  // a cancel PUTs, a save/empty-cancel DELETEs — all fire-and-forget, the
  // session concept keeps working when the server call fails.
  const draftType = draftEntity?.type
  const draftId = draftEntity?.id
  // Load any durable draft for this dossier once per draftType/draftId; a failed fetch simply keeps the session-only concept.
  useEffect(() => {
    if (!draftType || !draftId) return
    const ctrl = new AbortController()
    getNoteDraft(draftType, draftId, ctrl.signal)
      .then(stored => { if (stored) setConcept(prev => prev ?? stored) })
      .catch(() => { /* honest degrade: session-only */ })
    return () => ctrl.abort()
  }, [draftType, draftId])
  // POPOUT-HANDOFF-1 (Danny 09-08: "moet bestaand venster sluiten en de pop-out
  // direct openen in het versleepbare scherm, zoals bij profieltekst"). Popping out
  // is a HANDOFF, not a second copy: two editors for one thread means whichever you
  // typed in last silently wins. Since -HANDOFF-1 the TEXT moves with it and the
  // closing waits for the receiving window's ack — handled in the hook, which calls
  // back into the state setters above; a failed handoff simply never closes this.
  const composerOpen = adding || incomingDraft != null
  const openEdit = (i: number) => { setEditingIdx(i); setAdding(true) }
  // NoteComposer hands back the finished payload; this is the only place that
  // still decides add-vs-edit (the index into the FULL `notes` array).
  const handleSaveConcept = (draft: NoteDraft | null) => {
    setConcept(draft)
    if (!draftEntity) return
    if (draft) putNoteDraft(draftEntity.type, draftEntity.id, draft).catch(() => { /* session concept still holds */ })
    else deleteNoteDraft(draftEntity.type, draftEntity.id).catch(() => { /* stale server draft is cleaned up server-side after 30 days */ })
  }
  // Finalizes a note save (add or edit): clears the concept/draft, applies the add-vs-edit branch, then closes the composer.
  const handleSave = (payload: NotePayload) => {
    setConcept(null)
    if (draftEntity) deleteNoteDraft(draftEntity.type, draftEntity.id).catch(() => { /* server cleanup catches strays */ })
    if (editingIdx == null) onAddNote?.(payload)
    else onEditNote?.(editingIdx, payload)
    closeComposer()
  }
  // Delete — staged behind the shared confirm dialog; index mirrors openEdit/onEditNote.
  const requestDelete = (i: number) => confirm(labels.deleteConfirm ?? '', () => onDeleteNote?.(i), { danger: true })

  // NOTE-UNDO-FE-1 (K-172): peek + stage the restore — logic lives in the
  // extracted hook (§3, this file's own 400-line split trigger) so this stays a
  // thin renderer; the preview panel is still built HERE via SafeHtml.
  const { restoringIdx, requestRestorePrevious } = useNoteRestorePrevious({
    onFetchPreviousVersion, onRestorePreviousNote, confirm, formatDateTime, t,
    restoreConfirmTitle: labels.restoreConfirmTitle,
    renderPreview: html => <SafeHtml style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 4 }} html={html} />,
  })

  // Note-type chip resolution, the system-event row and the merged timeline
  // builder now live in `notes/notesTimeline.tsx` (§3 split) — this container
  // only calls them with its own data + labels.
  const mergedTimelineEvents = useMergedTimelineEvents({
    systemNotes, timeline, chipTypes, noteTypes, onEditStatusEvent,
    editStatusEventLabel: labels.editStatusEvent, openChangelogLabel: labels.openChangelog,
    timelineName, renderTimelineContent, noteAuthor,
  })

  // Load-error state (see NotesTabProps.error) — a calm danger row replaces the
  // whole tab body, same shape as MatchContractSection's error+retry; no button
  // at all when the host hasn't wired a retry point (back-compat).
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)', padding: '10px 2px' }}>
        <span>{labels.loadError}</span>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>{labels.retry}</Button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Notes */}
      {showNotes && (
      <div>
        {/* No section title (Danny 05-08 "zelfde bij notities" — the tab already names
            the section): the toolbar starts with the search bar on the LEFT, growing,
            at the drill-down's standard footprint (6/10, radius 8, fontSize 12). */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
          </div>
          {/* NOTES-DOC-FILTER-MENU-1 (Danny 08-08): type + channel now live BEHIND
              this one compact Filter button instead of two inline dropdowns — the
              dropdowns themselves are unchanged (still the house searchable
              SelectMenu), only where they live changed. Self-hides when the host
              offers neither vocabulary (DrawerFilterMenu renders null on empty). */}
          <DrawerFilterMenu filters={filterRows}
            label={t('filters.button', { defaultValue: 'Filter' })}
            title={t('filters.title')} clearAllLabel={t('filters.clearAll')} />
          {/* NOTITIE-POPOUT-EDIT-1 (Danny 10-08): the toolbar's own pop-out button is
              GONE — it opened the thread but never an editor, which is exactly what
              Danny reported twice. The affordance now lives per NOTE, beside that
              note's pencil and bin (see the note rows below). */}
          {/* Shared reference-style add button (Danny 20-07: notitie-knop had geen
              achtergrondkleur) — one look on every entity's notes tab. Short text
              (DRAWER-ADD-SHORT-1, Danny 05-08): this always renders inside a
              drawer sub-tab, never a full page. Opens the POPUP composer now
              (POPUP-SLEEP-1) instead of an inline block. */}
          {!composerOpen && <DrawerAddButton onClick={() => setAdding(true)} label={labels.newNote} short />}
        </div>
        {/* POPUP-SLEEP-1: the add/edit composer — see notes/NoteComposer.tsx.
            EDIT-PREFILL-1 (Danny 08-08 "popup maar geen txt erin"): the composer
            holds its fields in state initialized from `initialNote` at MOUNT — but
            this component stays mounted across opens, so an edit-open reused the
            stale empty state from page load. The `key` forces a fresh mount per
            compose target (new vs edit-i), so the fields always seed from the
            note actually being edited. */}
        <NoteComposer
          key={incomingDraft ? 'handoff' : editingIdx != null ? `edit-${editingIdx}` : adding ? (concept ? 'concept' : 'new') : 'idle'}
          open={composerOpen}
          initialNote={editingIdx != null ? notes[editingIdx] : null}
          // Second screen: seeded FROM a handed-over draft in the popout window,
          // and the source OF one in the drill-down (never both in one render).
          // A NEW open with a kept concept restores that concept instead.
          initialDraft={incomingDraft ?? (adding && editingIdx == null ? concept : null)}
          conceptRestored={Boolean(!incomingDraft && adding && editingIdx == null && concept)}
          onDraft={handleSaveConcept}
          noteTypes={noteTypes} channels={channels} labels={labels} editorLabels={editorLabels}
          composerExtra={composerExtra}
          onPopOutDraft={popout && !isPopoutWindow && NOTES_THREAD_POPOUT_ENTITIES.has(popout.entity) ? handOff : undefined} popOutPending={handoffPending}
          // r2 punt-6 gat: candidateId was dead-wired (never passed) — the
          // executed appointment link never rendered in production. The popout
          // prop already names the host entity+id; forward it for candidates.
          candidateId={popout?.entity === 'candidate' ? String(popout.id) : undefined}
          onSave={handleSave} onCancel={closeComposer}
        />
        <div style={sectionBlock}>
        {visibleNotes.length === 0 && !composerOpen
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.notesEmpty}</div>
          : visibleNotes.map(({ n, i }) => {
              // Safety net: a stray system note still renders as an event row here.
              // System-row + regular-row rendering now live in notes/notesTimeline
              // and notes/NoteRow (§3 split) — this container only wires the data.
              if (isSystemNote(n)) {
                return renderSystemRow(n, i, { labels, chipTypes, noteTypes, onEditStatusEvent, noteAuthor, noteWhen })
              }
              return (
                <NoteRow key={i} n={n} i={i} who={noteAuthor(n)} authorInitials={authorInitials}
                  chipTypes={chipTypes} noteTypes={noteTypes} channels={channels} labels={labels} t={t}
                  noteWhen={noteWhen} noteEditor={noteEditor} noteEdited={noteEdited} canManageNote={canManageNote}
                  onEditNote={onEditNote} onDeleteNote={onDeleteNote} openEdit={openEdit} requestDelete={requestDelete}
                  canPopOutNote={canPopOutNote} openNoteWindow={openNoteWindow} noteIdOf={noteIdOf}
                  onFetchPreviousVersion={onFetchPreviousVersion} onRestorePreviousNote={onRestorePreviousNote}
                  restoringIdx={restoringIdx} requestRestorePrevious={requestRestorePrevious} />
              )
            })
        }
      </div>
      </div>
      )}

      {/* Timeline — converged onto the shared EventTimeline (NOTES-TIMELINE-
          CONVERGE-1, 14-08): this hand-rolled TimelineRail block used to be the
          ONLY fork of the axis+day-grouping look the vacancy/application Tijdlijn
          tabs already share. System events (status/phase changes) and the host's
          own timeline items are merged into ONE chronological list (previously
          two separate blocks: all system events first, then the timeline —
          a genuine ordering gap this convergence also fixes) and handed to
          EventTimeline, which owns the day headings, the four states and the axis.
          Two capabilities didn't exist there yet and were EXTENDED onto the shared
          component rather than kept as a fork: (1) `onMarkerClick`/`markerLabel`
          on TimelineEvent, so the "open changelog" affordance can still live on the
          marker itself (TimelineRail's dot becomes a real button); (2) `trailing`
          already existed and now carries the per-row status-edit pencil. */}
      {showTimeline && (
      <SectionCard title={labels.timeline}>
        <EventTimeline
          emptyText={labels.timelineEmpty}
          kindMeta={kind => kind === 'system' ? { icon: History, color: 'var(--text-muted)' } : undefined}


          events={mergedTimelineEvents}
        />
      </SectionCard>
      )}

      {/* Conversations */}
      {showConversations && (
      <SectionCard title={labels.conversations}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.conversationsEmpty}</div>
      </SectionCard>
      )}

      {/* Staged delete confirmation (requestDelete above) — fixed-position overlay, safe anywhere in the tree. */}
      {dialog}
    </div>
  )
}
