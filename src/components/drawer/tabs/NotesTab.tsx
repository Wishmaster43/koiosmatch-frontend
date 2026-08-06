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
 */
import { useState, useEffect } from 'react'
import type { CSSProperties, ReactNode, ComponentType } from 'react'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Edit2, Save, X, Mail, PhoneCall, MessageCircle, Building2, Video, FileText, History, Search, Trash2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SafeHtml from '@/components/ui/SafeHtml'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import TimelineRail from '@/components/ui/TimelineRail'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'

// Strip tags for search matching only (display still goes through SafeHtml) —
// a raw substring match against the stored HTML would miss/false-match on markup.
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ')

interface NoteType { value: string; label: string; color?: string }
// author_id (RECHTEN-DETAIL-1): the note creator's user id, present only on hosts that
// implement the rights model — undefined (key absent) vs. explicit null are DIFFERENT
// states, see the RIGHTS comment above.
interface NoteItem { type?: string; channel?: string; title?: string; author?: string; author_name?: string; author_id?: string | number | null; created_by?: string | { name?: string }; updated_by?: string | { name?: string }; edited_by?: string; text?: string; body?: string; ago?: string; created_at?: string; updated_at?: string; [k: string]: unknown }
interface TimelineItem { time?: string; created_at?: string; text?: string; description?: string; [k: string]: unknown }
interface NotesLabels {
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
interface NotePayload { type: string; title: string; body: string; channel?: string }

// Icon per contact-channel slug — shown on the picker + the chip (mirrors CandidatesTable).
const CHANNEL_ICON: Record<string, ComponentType<{ size?: number }>> = {
  email: Mail, phone: PhoneCall, call: PhoneCall, whatsapp: MessageCircle,
  whatsapp_private: MessageCircle, appointment: Building2, meet: Video, note: FileText,
}

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
  error, onRetry, composerExtra,
}: NotesTabProps) {
  const [adding, setAdding]   = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)   // null = new; index = editing
  const [body, setBody]       = useState('')
  const [title, setTitle]     = useState('')
  const [type, setType]       = useState(noteTypes[0]?.value ?? '')
  // Resync when the host swaps the writable type list mid-compose (the customer tab's
  // link-level picker switches scope INSIDE the composer since 05-08 — a stale type
  // from the previous scope would 422 on save). Loop-safe: after the reset the guard
  // no-ops; mirrors usePlanIntakeForm's default-resync pattern.
  useEffect(() => {
    if (noteTypes.length === 0 || noteTypes.some(nt => nt.value === type)) return
    setType(noteTypes[0].value)
  }, [noteTypes, type])
  // Optional contact channel — empty = internal note (no contact moment).
  const [channel, setChannel] = useState('')
  const [expanded, setExpanded] = useState(false)
  // Notes search (Danny 03-08) — client-side over the already-loaded `notes` prop.
  const [search, setSearch] = useState('')
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
  // Ownership gate (RECHTEN-DETAIL-1) — see the RIGHTS doc comment at the top of
  // this file for the undefined-vs-null distinction that keeps non-migrated hosts
  // unrestricted while candidates get the real BE-mirrored rule.
  const canManageNote = (n: NoteItem) => {
    if (n.author_id === undefined) return true
    const isOwn = n.author_id !== null && currentUserId != null && String(n.author_id) === String(currentUserId)
    return isOwn || hasPermission(managePermission)
  }
  // Search narrows on body text (HTML stripped) + author name. The original index
  // is kept alongside each note (not just filtered away) because openEdit/
  // onEditNote key off a note's position in the FULL `notes` array, not the
  // filtered view — mirrors the DRILL-PAGER convention used elsewhere.
  const q = search.trim().toLowerCase()
  const visibleNotes = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => !q || stripHtml(String(n.text ?? n.body ?? '')).toLowerCase().includes(q) || String(noteAuthor(n)).toLowerCase().includes(q))
  // System notes (backend-written status/phase changes) render as a calm event row —
  // no avatar, no edit pencil, just the "Statuswissel" chip + who/when (N-1-FE).
  const isSystemNote = (n: NoteItem) => Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))

  const reset = () => { setAdding(false); setEditingIdx(null); setBody(''); setTitle(''); setType(noteTypes[0]?.value ?? ''); setChannel(''); setExpanded(false) }
  const openEdit = (i: number) => {
    const n = notes[i]
    setType(n.type ?? noteTypes[0]?.value ?? ''); setChannel(n.channel ?? ''); setTitle(n.title ?? ''); setBody(n.text ?? n.body ?? '')
    setEditingIdx(i); setAdding(true)
  }
  const save = () => {
    const payload: NotePayload = { type, title, body, channel: channel || undefined }
    if (editingIdx == null) onAddNote?.(payload)
    else onEditNote?.(editingIdx, payload)
    reset()
  }
  // Delete — staged behind the shared confirm dialog; index mirrors openEdit/onEditNote.
  const requestDelete = (i: number) => confirm(labels.deleteConfirm ?? '', () => onDeleteNote?.(i), { danger: true })
  const typeLabel = noteTypes.find(n => n.value === type)?.label ?? ''
  const iconBtn: CSSProperties = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }

  // Note-type chip: resolves value→label against ALL types (chipTypes) — the
  // composer list excludes system types, which made the chip fall back to the
  // raw slug ("status_change" instead of "Statuswissel", Danny 13/7).
  const renderTypeChip = (value: string) => {
    const nt = (chipTypes ?? noteTypes).find(n => n.value === value || n.label === value)
    const col = nt?.color
    const soft: CSSProperties = col
      ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
      : { background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, marginRight: 6, ...soft }}>{nt?.label ?? value}</span>
  }

  // Channel chip — resolves value→label from the contact-channel lookup; soft tint.
  const renderChannelChip = (value: string) => {
    const ch = channels.find(c => c.value === value || c.label === value)
    const col = ch?.color ?? 'var(--color-secondary)'
    const isHex = typeof col === 'string' && col.startsWith('#')
    const soft: CSSProperties = isHex
      ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
      : { background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)` }
    const Icon = CHANNEL_ICON[value]
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, marginRight: 6, ...soft }}>{Icon && <Icon size={10} />}{ch?.label ?? value}</span>
  }

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
          {n.type && renderTypeChip(n.type)}
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
          {/* Shared reference-style add button (Danny 20-07: notitie-knop had geen
              achtergrondkleur) — one look on every entity's notes tab. Short text
              (DRAWER-ADD-SHORT-1, Danny 05-08): this always renders inside a
              drawer sub-tab, never a full page. */}
          {!adding && <DrawerAddButton onClick={() => setAdding(true)} label={labels.newNote} short />}
        </div>
        <div style={sectionBlock}>
        {adding && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Host-supplied composer row (e.g. the customer tab's link-level picker) —
                sits ABOVE the type row because the picked scope drives the type list. */}
            {editingIdx === null && composerExtra}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{labels.type}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {/* §4 soft-tint (audit r4): mirrors the channel pills below — active is
                    tinted (never a solid fill), inactive uses the surface token (the old
                    literal 'white' was invisible-on-dark). */}
                {noteTypes.map(nt => (
                  <button key={nt.value} onClick={() => setType(nt.value)}
                    style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer',
                      border: `1px solid ${type === nt.value ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                      background: type === nt.value ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--surface)',
                      color: type === nt.value ? 'var(--color-primary)' : 'var(--text)', fontWeight: type === nt.value ? 600 : 400 }}>
                    {nt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Contact channel — optional; picking one marks this note a contact moment.
                No "internal" button: no channel selected = internal note (that's the note TYPE).
                Soft-chip toggle (§4) with an icon; click a selected channel again to clear it. */}
            {channels.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{labels.channel}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {channels.map(ch => {
                    const active = channel === ch.value
                    const col = ch.color ?? 'var(--color-primary)'
                    const Icon = CHANNEL_ICON[ch.value]
                    return (
                      <button key={ch.value} type="button" onClick={() => setChannel(active ? '' : ch.value)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11,
                          fontWeight: active ? 600 : 500, borderRadius: 99, cursor: 'pointer', color: col,
                          background: `color-mix(in srgb, ${col} ${active ? 16 : 8}%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${col} ${active ? 50 : 28}%, transparent)` }}>
                        {Icon && <Icon size={12} />} {ch.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={labels.notePlaceholder?.(typeLabel)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
            <RichTextEditor value={body} onChange={setBody} expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} labels={editorLabels} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button onClick={save} title={labels.save}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={15} /></button>
              <button onClick={reset} title={labels.cancel}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={15} /></button>
            </div>
          </div>
        )}
        {visibleNotes.length === 0 && !adding
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
                      {n.type && renderTypeChip(n.type)}
                      {n.channel && renderChannelChip(n.channel)}
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? who}</span>
                    </div>
                    {/* "By whom · when" (always) + "edited by X" once the backend logs it (NOTES-2b). */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {who ? `${who} · ` : ''}{noteWhen(n)}
                      {noteEdited(n) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title={labels.edit as string}>
                          <Edit2 size={9} /> {noteEditor(n)}
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
