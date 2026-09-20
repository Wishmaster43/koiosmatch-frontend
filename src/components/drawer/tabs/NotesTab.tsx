/**
 * NotesTab — generic communication tab: notes (with a rich-text composer) +
 * timeline + conversations. Entity-agnostic; data + labels via props so it works
 * for candidates, customers, vacancies, tasks alike.
 *
 * SEARCH (Danny 03-08: "I want a search bar on notes too") — added
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
 * POPUP-SLEEP-1 / NOTE-ASSIST-1 / NOTE-TAAL-1 (Danny 06-08: "no popup, no
 * spellchecker, no box for the Koios AI improvements"): the add/edit
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
 * can really PATCH a note (`canHandOffNote` → NOTE_EDIT_POPOUT_ENTITIES — since
 * the 02-09 measurement: candidate, application, customer, vacancy, task, match and
 * opportunity, all served by NoteEditPopout) and only where this user may edit the
 * note here as well (same gate as the pencil).
 */
import { NOTES_THREAD_POPOUT_ENTITIES } from '@/lib/secondScreen'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'
import { History } from 'lucide-react'
import EventTimeline from '@/components/ui/EventTimeline'
import SafeHtml from '@/components/ui/SafeHtml'
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import { useDateFormat } from '@/lib/datetime'
import Button from '@/components/ui/Button'
import NoteComposer from './notes/NoteComposer'
import { useNoteComposerDraft } from './notes/useNoteComposerDraft'
import { useNoteRestorePrevious } from './notes/useNoteRestorePrevious'
import { useNotesPopoutHandoff } from './notes/useNotesPopoutHandoff'
import { renderSystemRow, useMergedTimelineEvents } from './notes/notesTimeline'
import NoteRow from './notes/NoteRow'
import NotesToolbar from './notes/NotesToolbar'
import { useNotesMeta } from './notes/useNotesMeta'
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

// Prop/data shapes extracted to notes/notesTabTypes.ts (§3 split) — re-exported
// here so every existing `import type { ... } from '.../NotesTab'` still works.
export type {
  NoteType, NoteItem, NotePreviousVersion, TimelineItem, NotesLabels,
  NoteActionItemWire, NotePayload, NotesTabProps,
} from './notes/notesTabTypes'
import type { NoteItem, NotesTabProps } from './notes/notesTabTypes'

// Entity-agnostic notes/timeline/conversations tab; all entity-specific labels and data arrive via props (see file header).
export default function NotesTab({
  draftEntity,
  notes = [], systemNotes = [], timeline = [], noteTypes = [], chipTypes, channels = [], labels = {}, editorLabels,
  authorInitials, timelineName, onAddNote, onEditNote, onDeleteNote,
  onFetchPreviousVersion, onRestorePreviousNote,
  managePermission = 'candidates.notes.manage_all',
  showNotes = true, showTimeline = true, showConversations = true, onEditStatusEvent, renderTimelineContent,
  error, onRetry, composerExtra, popout, noteLinks,
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
  // K-225/H2 meta-sentence resolution (status/phase value slugs → reader's label) — extracted (§3 split).
  const { metaBody } = useNotesMeta()
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

  // POPOUT-HANDOFF-1 (Danny 09-08: "must close the existing window and open the pop-out
  // directly in the draggable panel, like the profile text"). Popping out
  // is a HANDOFF, not a second copy: two editors for one thread means whichever you
  // typed in last silently wins. Since -HANDOFF-1 the TEXT moves with it and the
  // closing waits for the receiving window's ack — handled in the hook, which calls
  // back into the state setters above; a failed handoff simply never closes this.
  const composerOpen = adding || incomingDraft != null
  const openEdit = (i: number) => { setEditingIdx(i); setAdding(true) }
  // Concept/draft lifecycle (session + durable K-161) and the add/edit/delete
  // save wiring — extracted (§3 split).
  const { concept, closeComposer, handleSaveConcept, handleSave, requestDelete } = useNoteComposerDraft({
    draftEntity, editingIdx, setAdding, setEditingIdx, clearIncoming,
    onAddNote, onEditNote, onDeleteNote, confirm, deleteConfirmLabel: labels.deleteConfirm,
  })

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
    timelineName, renderTimelineContent, noteAuthor, bodyOf: metaBody,
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
        {/* Search + filter + add row — extracted to NotesToolbar (§3 split). */}
        <NotesToolbar
          search={search} onSearchChange={setSearch} searchPlaceholder={labels.searchPlaceholder}
          filterRows={filterRows}
          filterLabel={t('filters.button', { defaultValue: 'Filter' })}
          filterTitle={t('filters.title')} filterClearAllLabel={t('filters.clearAll')}
          composerOpen={composerOpen} onAddNote={() => setAdding(true)} newNoteLabel={labels.newNote}
        />
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
                return renderSystemRow(n, i, { labels, chipTypes, noteTypes, onEditStatusEvent, noteAuthor, noteWhen, bodyOf: metaBody })
              }
              return (
                <NoteRow key={i} n={n} i={i} who={noteAuthor(n)} authorInitials={authorInitials}
                  chipTypes={chipTypes} noteTypes={noteTypes} channels={channels} labels={labels} t={t}
                  noteWhen={noteWhen} noteEditor={noteEditor} noteEdited={noteEdited} canManageNote={canManageNote}
                  onEditNote={onEditNote} onDeleteNote={onDeleteNote} openEdit={openEdit} requestDelete={requestDelete}
                  canPopOutNote={canPopOutNote} openNoteWindow={openNoteWindow} noteIdOf={noteIdOf}
                  onFetchPreviousVersion={onFetchPreviousVersion} onRestorePreviousNote={onRestorePreviousNote}
                  restoringIdx={restoringIdx} requestRestorePrevious={requestRestorePrevious}
                  noteLinks={noteLinks} bodyOverride={metaBody(n)} />
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
