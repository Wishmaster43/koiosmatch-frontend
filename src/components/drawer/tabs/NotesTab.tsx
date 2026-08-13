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
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { Edit2, ExternalLink, History, Search, Trash2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SafeHtml from '@/components/ui/SafeHtml'
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import TimelineRail from '@/components/ui/TimelineRail'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import { useNotesPopout } from '@/hooks/useNotesPopout'
import type { NotesPopoutTarget } from '@/hooks/useNotesPopout'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { openNoteEditPopout } from '@/lib/secondScreen'
import NoteComposer from './notes/NoteComposer'
import { NoteTypeChip, NoteChannelChip } from './notes/NoteChips'
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
// spellcheck/output language, optional — null/absent = tenant default.
export interface NoteItem { type?: string; channel?: string; title?: string; author?: string; author_name?: string; author_id?: string | number | null; created_by?: string | { name?: string }; updated_by?: string | { name?: string }; edited_by?: string; text?: string; body?: string; ago?: string; created_at?: string; updated_at?: string; language?: string; [k: string]: unknown }
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
}
// NOTE-TAAL-1: `language` rides along on save/edit — optional, undefined means
// "let the backend default to the tenant language" (never force a value the
// recruiter never picked).
export interface NotePayload { type: string; title: string; body: string; channel?: string; language?: string }

interface NotesTabProps {
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
  timelineInitials?: string
  onAddNote?: (payload: NotePayload) => void
  onEditNote?: (i: number, payload: NotePayload) => void
  // Delete a note by its index in the full `notes` array (mirrors onEditNote).
  // Omitted (every current host) → no delete button renders at all — no fake
  // affordance (§3). RECHTEN-DETAIL-1 gating (see canManageNote) applies to it
  // exactly like the edit pencil.
  onDeleteNote?: (i: number) => void
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

export default function NotesTab({
  notes = [], systemNotes = [], timeline = [], noteTypes = [], chipTypes, channels = [], labels = {}, editorLabels,
  authorInitials, timelineName, timelineInitials, onAddNote, onEditNote, onDeleteNote,
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
  const { formatDate, formatDateTime } = useDateFormat()
  // Rights model (RECHTEN-DETAIL-1): current user id + the UI-gate permission check
  // (never security — the BE re-checks). Null-safe: a host with no AuthProvider in
  // its render tree (existing tests, hosts that haven't migrated) still works —
  // hasPermission just always says no, matching the pre-existing GeocodeButton pattern.
  const auth = useAuth()
  const currentUserId = auth?.user?.id
  const hasPermission = auth?.hasPermission ?? (() => false)
  // Delete goes through the shared confirm dialog, never a native window.confirm() (§0).
  const { confirm, dialog } = useConfirm()
  // Second screen (NOTITIE-POPOUT-HANDOFF-1 / -EDIT-1): handing the composer's
  // half-typed note over, handing ONE existing note over to be edited there, and —
  // when this render IS that window — taking either over. The protocol lives in
  // the hook (§3). Only a DRAFT handoff closes the composer here: an edit handoff
  // left the note in the list untouched, so closing on its ack would throw away
  // whatever else the recruiter happened to have open.
  const { isWindow: isPopoutWindow, handOff, canHandOffNote, pending: handoffPending, incoming, incomingNoteId, ack, clearIncoming } =
    useNotesPopout({ target: popout, onHandedOver: kind => { if (kind === 'draft') { setAdding(false); setEditingIdx(null) } } })
  // A handed-over draft is only taken over while THIS composer is free: overwriting
  // a note being written here would just move the text loss elsewhere. Not taken
  // over = never acked = the drill-down keeps its own text (see the hook).
  const incomingDraft = adding ? null : incoming
  // Ack from an EFFECT, i.e. after the render that actually shows the draft — the
  // other window may close only once this one demonstrably holds the text.
  useEffect(() => { if (incomingDraft) ack() }, [incomingDraft, ack])
  // Window side (NOTITIE-POPOUT-EDIT-1): the drill-down asked this window to open
  // ONE existing note in its editor. Resolved against the thread THIS window
  // loaded — never against anything the sender sent — and only while this composer
  // is free, so a note being written here is never overwritten. Not found (thread
  // still loading, note outside this window's scope) = index -1 = nothing happens
  // and nothing is acked, which is what keeps the drill-down honest.
  const incomingEditIdx = incomingNoteId != null && !adding
    ? notes.findIndex(n => noteIdOf(n) === incomingNoteId)
    : -1
  useEffect(() => {
    if (incomingEditIdx < 0) return
    setEditingIdx(incomingEditIdx)
    setAdding(true)
  }, [incomingEditIdx])
  // Confirm ONLY from a render where the composer really holds that exact note —
  // acking on the request alone would tell the drill-down the note is being edited
  // here while this window never found it.
  useEffect(() => {
    const shown = editingIdx == null ? undefined : notes[editingIdx]
    if (incomingNoteId == null || !adding || !shown) return
    if (noteIdOf(shown) !== incomingNoteId) return
    ack()
  }, [incomingNoteId, adding, editingIdx, notes, ack])

  // Load-error state (see NotesTabProps.error) — a calm danger row replaces the
  // whole tab body, same shape as MatchContractSection's error+retry; no button
  // at all when the host hasn't wired a retry point (back-compat).
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger)', padding: '10px 2px' }}>
        <span>{labels.loadError}</span>
        {onRetry && (
          <button onClick={onRetry} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '3px 9px', cursor: 'pointer', color: 'var(--text)' }}>{labels.retry}</button>
        )}
      </div>
    )
  }
  // Note timestamp: real date+time when the note carries one, else the relative "ago".
  const noteWhen = (n: NoteItem) => n.created_at
    ? formatDate(n.created_at as string, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  // more than the pencil does.
  const canPopOutNote = canHandOffNote && Boolean(onEditNote)
  // NOTITIE-POPOUT-URL-1 (live 13-08 "zoals de profieltekst"): the row icon opens
  // the note's OWN window by URL — no channel handoff, no race, no pending state.
  const openNoteWindow = (noteId: string) => {
    if (!popout) return
    if (!openNoteEditPopout(popout.entity, popout.id, noteId)) notifyError(t('popupBlocked'))
  }
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
  const handleSave = (payload: NotePayload) => {
    if (editingIdx == null) onAddNote?.(payload)
    else onEditNote?.(editingIdx, payload)
    closeComposer()
  }
  // Delete — staged behind the shared confirm dialog; index mirrors openEdit/onEditNote.
  const requestDelete = (i: number) => confirm(labels.deleteConfirm ?? '', () => onDeleteNote?.(i), { danger: true })

  // Note-type chip: resolves value→label against ALL types (chipTypes) — the
  // composer list excludes system types, which made the chip fall back to the
  // raw slug ("status_change" instead of "Statuswissel", Danny 13/7).
  // Calm one-line system-event row (status/phase change): History icon, chip, no pencil
  // by default. The icon is a BUTTON that opens the record changelog (Danny 13/7) —
  // decoupled via a window event so this shared tab needs no drawer-specific wiring.
  const systemRow = (n: NoteItem, key: string | number) => {
    const who = noteAuthor(n)
    // Only the "Statuswissel" event (n.type === 'status_change') is editable in place —
    // never a 'lifecycle' event (archived/restored) — and only when the host actually
    // passed the callback (see onEditStatusEvent on the props for why).
    const canEditStatus = Boolean(onEditStatusEvent) && n.type === 'status_change'
    return (
      <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <button onClick={() => window.dispatchEvent(new CustomEvent('km:open-changelog'))}
          title={labels.openChangelog} aria-label={labels.openChangelog}
          style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hover-bg)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
          <History size={13} />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
          {n.type && <NoteTypeChip value={n.type} types={chipTypes ?? noteTypes} />}
          <SafeHtml style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0 }} html={n.text ?? n.body ?? ''} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{who ? `${who} · ` : ''}{noteWhen(n)}</span>
        </div>
        {canEditStatus && (
          <button onClick={onEditStatusEvent} title={labels.editStatusEvent} aria-label={labels.editStatusEvent}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}>
            <Edit2 size={13} />
          </button>
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
          key={incomingDraft ? 'handoff' : editingIdx != null ? `edit-${editingIdx}` : adding ? 'new' : 'idle'}
          open={composerOpen}
          initialNote={editingIdx != null ? notes[editingIdx] : null}
          // Second screen: seeded FROM a handed-over draft in the popout window,
          // and the source OF one in the drill-down (never both in one render).
          initialDraft={incomingDraft}
          noteTypes={noteTypes} channels={channels} labels={labels} editorLabels={editorLabels}
          composerExtra={composerExtra}
          onPopOutDraft={popout && !isPopoutWindow ? handOff : undefined} popOutPending={handoffPending}
          onSave={handleSave} onCancel={closeComposer}
        />
        <div style={sectionBlock}>
        {visibleNotes.length === 0 && !composerOpen
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.notesEmpty}</div>
          : visibleNotes.map(({ n, i }) => {
              const who = noteAuthor(n)
              // Safety net: a stray system note still renders as an event row here.
              if (isSystemNote(n)) return systemRow(n, i)
              return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Avatar initials={who ? initialsOf(who) : authorInitials} size={26} />
                <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      {n.type && <NoteTypeChip value={n.type} types={chipTypes ?? noteTypes} />}
                      {n.channel && <NoteChannelChip value={n.channel} channels={channels} />}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? who}</span>
                    </div>
                    {/* "By whom · when" (always) + "edited by X" once the backend logs it (NOTES-2b). */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {who ? `${who} · ` : ''}{noteWhen(n)}
                      {/* EDIT-MARKER-1 (Danny 08-08 "2 keer een potloodje"): plain italic
                          meta text, no icon — a pencil here read as a second edit BUTTON. */}
                      {noteEdited(n) && (
                        <span style={{ fontStyle: 'italic' }}>
                          · {t('notes.editedBy', { name: noteEditor(n), defaultValue: 'bewerkt door {{name}}' })}
                        </span>
                      )}
                    </span>
                    {/* RECHTEN-DETAIL-1: own note or manage_all — never a button the BE will 403. */}
                    {onEditNote && canManageNote(n) && (
                      <button onClick={() => openEdit(i)} title={labels.edit} aria-label={labels.edit}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
                        <Edit2 size={13} />
                      </button>
                    )}
                    {onDeleteNote && canManageNote(n) && (
                      <button onClick={() => requestDelete(i)} title={labels.deleteNote} aria-label={labels.deleteNote}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                    {/* NOTITIE-POPOUT-EDIT-1 → URL-1: third icon of the same group —
                        same borderless, muted, 6px-left footprint as the pencil and
                        the bin. Opens THIS note's own second-screen window by URL
                        (the profile-text treatment): the id is in the address, so
                        there is no handoff to race and re-opening re-focuses the
                        same OS window. Same edit rights as the pencil, only where
                        that window can really save, never inside that window. */}
                    {canPopOutNote && canManageNote(n) && noteIdOf(n) && (
                      <button type="button" onClick={() => openNoteWindow(noteIdOf(n) as string)}
                        title={t('openSecondScreen')} aria-label={t('openSecondScreen')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '0 0 0 6px', display: 'flex' }}>
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                  <SafeHtml style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} html={n.text ?? n.body ?? ''} />
                </div>
              </div>
            )})
        }
      </div>
      </div>
      )}

      {/* Timeline */}
      {showTimeline && (
      <SectionCard title={labels.timeline}>
        {/* Status/phase-change events belong to the timeline (Danny 2026-07-13). */}
        {[...systemNotes]
          .sort((a, b) => (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0))
          .map((n, i) => systemRow(n, `sys-${i}`))}
        {(timeline.length > 0 || systemNotes.length > 0)
          ? timeline.map((ev, i) => (
              // paddingBottom (not marginBottom) keeps the spacing INSIDE the row's own
              // box, so TimelineRail's connector line reaches all the way to the next dot.
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12, alignItems: 'flex-start' }}>
                <TimelineRail isLast={i === timeline.length - 1} />
                <Avatar initials={timelineInitials} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{timelineName}</span>
                    {/* House date+time format — never the raw ISO string (Danny 05-08). */}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(ev.time ?? ev.created_at)}</span>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}>{renderTimelineContent?.(ev) ?? (ev.text ?? ev.description)}</div>
                </div>
              </div>
            ))
          : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels.timelineEmpty}</div>
        }
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
