/**
 * NoteEditPopout — ONE existing note in a second-screen window of its own
 * (NOTITIE-POPOUT-URL-1, Danny 11-08: "put the note id in the URL" — + live
 * 13-08: notes must work the same way the profile-text pop-out works).
 * Route: /popout/notes/:entity/:id/:noteId — the id in the URL is the whole
 * design: no BroadcastChannel handoff to resolve, no race against a thread
 * window's own loading, and re-opening the same note re-focuses its OS window.
 *
 * POPOUT-PARITEIT-1 (Danny 27-08: "notes as they work for the candidate must
 * work the same way for everything else … including pop-out"): generalised beyond candidate/
 * application to every entity whose notes route now really PATCHes a single
 * note (see NOTE_EDIT_POPOUT_ENTITIES's own docblock for the per-entity route
 * evidence) — customer, vacancy, task, match, opportunity. Four of those five
 * (vacancy/task/match/opportunity) share the exact same `{basePath}/notes/{id}`
 * shape the shared `useEntityNotes` hook already fetches/edits with, so they
 * ride ONE generic branch (`GenericNoteEditPopout`) parameterised by entity +
 * basePath + lite-identity hook — never a fifth hand-copied component (§11).
 * Customer keeps its own branch: its notes route takes a `rollup` query param
 * and its edit hook (usePopoutCustomerNotes) already existed pre-dating this
 * generalisation, so it is reused rather than forced onto the generic shape.
 * Any entity outside NOTE_EDIT_POPOUT_ENTITIES renders the honest error row
 * here, never a form whose save the server would 403 (§3, no fake affordance).
 *
 * A pasteable URL means THIS page re-decides the edit right (noteRights, the
 * same rule the list uses): someone else's note renders read-only with a notice,
 * never a form whose save the server would 403 (§7: UI gate, BE re-checks).
 */
import { useMemo, useState } from 'react'
import NoteActionsPanel from '@/components/drawer/tabs/notes/NoteActionsPanel'
import type { NoteActionPanelItem } from '@/components/drawer/tabs/notes/NoteActionsPanel'
import { mergeNoteActionItems, toKnownItems } from '@/components/drawer/tabs/notes/noteActionsPanelHelpers'
import { useMyKoiosMode } from '@/pages/auth/shared'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import PopoutShell from './PopoutShell'
import PopoutSaveFooter from './PopoutSaveFooter'
import { usePopoutWindowTitle } from './usePopoutWindowTitle'
import NoteFields from '@/components/drawer/tabs/notes/NoteFields'
// KOPPELEN-IN-POPOUT-1 (Danny 05-09): linking a note to its principals happens HERE, in the
// second-screen editor, never as a control inside the note row (the row only shows chips).
import { GroupLabel } from '@/components/ui/typography'
import NoteLinksRow from '@/components/drawer/tabs/notes/NoteLinksRow'
import type { Id } from '@/types/common'
import type { NoteLinkHost, NoteLinkItem } from '@/components/drawer/tabs/notes/noteLinksApi'
import { useNoteFields } from '@/components/drawer/tabs/notes/useNoteFields'
import { canManageNote, isSystemNote } from '@/components/drawer/tabs/notes/noteRights'
import SafeHtml from '@/components/ui/SafeHtml'
import CalloutBox from '@/components/ui/CalloutBox'
import { bodyTextStyle } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useEntityNotes } from '@/hooks/useEntityNotes'
import { useCandidateNotes, type CandidateNote } from '@/pages/candidates/shared'
import { useCandidateLite } from './hooks/useCandidateLite'
import { useApplicationLite } from './hooks/useApplicationLite'
import { useCustomerLite } from './hooks/useCustomerLite'
import { useVacancyLite } from './hooks/useVacancyLite'
import { useTaskLite } from './hooks/useTaskLite'
import { useMatchLite } from './hooks/useMatchLite'
import { useOpportunityLite } from './hooks/useOpportunityLite'
import { usePopoutApplicationNotes, type PopoutApplicationNote } from './hooks/usePopoutApplicationNotes'
import { usePopoutCustomerNotes } from './hooks/usePopoutCustomerNotes'
import type { NoteType, NotesLabels } from '@/components/drawer/tabs/NotesTab'

// Structural shape NoteEditor needs off a note — every entity's note shape
// already satisfies it, so ONE editor body serves all of them (§11).
interface EditableNote {
  id?: string | number
  // Bundle H2: the note's principal links (manual + derived); the editor offers the manual ones.
  links?: NoteLinkItem[]
  type?: string
  channel?: string
  title?: string
  body?: string
  text?: string
  language?: string
  author_id?: string | number | null
  [k: string]: unknown
}

// Dispatches on the entity route param to the right per-entity loader, or an honest error row for an entity this popout cannot really save yet.
export default function NoteEditPopout() {
  const { entity } = useParams()
  const { t } = useTranslation('common')

  if (entity === 'candidate') return <CandidateNoteEditPopout />
  if (entity === 'application') return <ApplicationNoteEditPopout />
  if (entity === 'customer') return <CustomerNoteEditPopout />
  if (entity === 'vacancy') {
    return <GenericNoteEditPopout entity="vacancy" i18nNs="vacancies" useLite={useVacancyLite}
      adapt={r => ({ record: r.vacancy, name: r.vacancy?.name ?? '', initials: r.vacancy?.initials ?? '' })} />
  }
  if (entity === 'task') {
    return <GenericNoteEditPopout entity="task" i18nNs="tasks" useLite={useTaskLite}
      adapt={r => ({ record: r.task, name: r.task?.name ?? '', initials: r.task?.initials ?? '' })} />
  }
  if (entity === 'match') {
    return <GenericNoteEditPopout entity="match" i18nNs="matches" useLite={useMatchLite}
      adapt={r => ({ record: r.match, name: r.match?.candidateName ?? '', initials: r.match?.initials ?? '', subtitle: r.match?.vacancyTitle })} />
  }
  if (entity === 'opportunity') {
    return <GenericNoteEditPopout entity="opportunity" i18nNs="opportunities" useLite={useOpportunityLite}
      adapt={r => ({ record: r.opportunity, name: r.opportunity?.name ?? '', initials: r.opportunity?.initials ?? '' })} />
  }
  // Any other entity has no route that can really PATCH a note yet (see
  // NOTE_EDIT_POPOUT_ENTITIES's own docblock for the current state per entity) —
  // an honest error row, never a form (§3).
  return (
    <PopoutShell loading={false} error loadingLabel={t('loading')} errorLabel={t('popout.loadError')} retryLabel={t('error.retry')}
      onRetry={() => {}} name="" initials="" subtitle="">
      {null}
    </PopoutShell>
  )
}

// --- Candidate branch (original NOTITIE-POPOUT-URL-1 implementation) ---------
function CandidateNoteEditPopout() {
  const { id, noteId } = useParams()
  const { t } = useTranslation('candidates')
  const { candidate, loading, error, reload } = useCandidateLite(id)
  const { notes, loaded, editNote } = useCandidateNotes(id)
  const { writableTypes } = useNoteTypes('candidate')
  const { types: channels } = useLastContactTypes('candidate')

  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as CandidateNote) : null

  // Sets the OS window title to the candidate name while this popout is open, restoring the previous title on close.
  usePopoutWindowTitle(candidate, t('popout.windowTitle', { name: candidate?.name }))

  const notFound = loaded && (!note || isSystemNote(note))
  const labels: NotesLabels = {
    type: t('communication.type'), channel: t('communication.channel'),
    notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }),
  }

  return (
    <PopoutShell
      loading={loading || (!loaded && !error)}
      error={Boolean(error) || !candidate || notFound}
      onRetry={reload}
      loadingLabel={t('common:loading')}
      errorLabel={notFound ? t('popout.noteNotFound') : t('popout.loadError')}
      retryLabel={t('common:error.retry')}
      name={candidate?.name ?? ''} initials={candidate?.initials ?? ''} subtitle={t('sections.notes')}
    >
      {note && (
        <NoteEditor key={String(noteId)} note={note} managePermission="candidates.notes.manage_all"
          onSave={payload => editNote(noteIndex, payload)}
          links={id && noteId ? { host: 'candidates', hostId: id, noteId } : undefined}
          noteTypes={writableTypes} channels={channels} labels={labels} readOnlyCopy={t('popout.noteReadOnly')} />
      )}
    </PopoutShell>
  )
}

// Shared shell for the two branches whose loading/error copy and note-editor wiring
// are IDENTICAL down to the key names (ApplicationNoteEditPopout and
// GenericNoteEditPopout) — only the record/name/subtitle/permission differ.
// Candidate/customer stay their own branches: they use their OWN i18n namespace's
// popout keys (not `common:`) and pass a `links` prop these two never do.
function SimpleNotePopoutShell({ loading, error, notesLoading = false, notesError = false, record, reload, name, initials, subtitle, note, noteId, onSave, managePermission, writableTypes, t }: {
  loading: boolean
  error: unknown
  // The NOTES request's own settled state (§8/§9) — separate from the identity
  // fetch above, since a fast identity load must never claim "note not found"
  // while the actual notes list is still loading or failed.
  notesLoading?: boolean
  notesError?: boolean
  record: unknown
  reload: () => void
  name: string
  initials: string
  subtitle?: string
  note: EditableNote | null
  noteId: string | undefined
  // Caller pre-binds its own editNote(noteIndex, payload) — keeps this shell's
  // signature free of each entity's own return type (Promise<boolean> vs void).
  onSave: (payload: { type: string; title: string; body: string; channel?: string; language?: string }) => Promise<boolean>
  managePermission: string
  writableTypes: NoteType[]
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const combinedLoading = loading || notesLoading
  const combinedError = Boolean(error) || notesError
  const notFound = !combinedLoading && !combinedError && (!note || isSystemNote(note))
  const labels: NotesLabels = { type: t('notes.type'), notePlaceholder: () => t('notes.placeholder') }
  return (
    <PopoutShell
      loading={combinedLoading}
      error={combinedError || !record || notFound}
      onRetry={reload}
      loadingLabel={t('common:loading')}
      errorLabel={notFound ? t('common:popout.noteNotFound') : t('common:popout.loadError')}
      retryLabel={t('common:error.retry')}
      name={name} initials={initials} subtitle={subtitle || t('notes.title')}
    >
      {note && (
        <NoteEditor key={String(noteId)} note={note} managePermission={managePermission}
          onSave={onSave}
          noteTypes={writableTypes} channels={[]} labels={labels} readOnlyCopy={t('common:popout.noteReadOnly')} />
      )}
    </PopoutShell>
  )
}

// --- Application branch (A-popout-1) -----------------------------------------
function ApplicationNoteEditPopout() {
  const { id, noteId } = useParams()
  const { t } = useTranslation('applications')
  const { application, loading, error, reload } = useApplicationLite(id)
  // usePopoutApplicationNotes fires its OWN GET /applications/{id} (§9) — its
  // loading/error are passed through separately so "note not found" only shows
  // once the notes request itself has actually settled.
  const { notes, loading: notesLoading, error: notesError, reload: reloadNotes, editNote } = usePopoutApplicationNotes(id)
  const { writableTypes } = useNoteTypes('application')
  const retry = () => { reload(); reloadNotes() }

  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as PopoutApplicationNote) : null

  // Sets the OS window title to the application candidate name while this popout is open, restoring the previous title on close.
  usePopoutWindowTitle(application, t('common:popout.windowTitle', { name: application?.candidateName }))

  return (
    <SimpleNotePopoutShell loading={loading} error={error} notesLoading={notesLoading} notesError={notesError} record={application} reload={retry}
      name={application?.candidateName ?? ''} initials={application?.initials ?? ''} subtitle={application?.vacancyTitle}
      note={note} noteId={noteId} onSave={payload => editNote(noteIndex, payload)}
      managePermission="applications.notes.manage_all" writableTypes={writableTypes} t={t} />
  )
}

// --- Customer branch (POPOUT-PARITEIT-1) -------------------------------------
// Kept as its own branch rather than folded into GenericNoteEditPopout: the
// customer notes route takes a `rollup` query param (location/department-linked
// notes) and usePopoutCustomerNotes already carried the matching editNote
// before this generalisation — reused as-is (§11, no second copy of a working hook).
function CustomerNoteEditPopout() {
  const { id, noteId } = useParams()
  const { t } = useTranslation('customers')
  const { customer, loading, error, reload } = useCustomerLite(id)
  // usePopoutCustomerNotes fires its OWN GET /customers/{id}/notes (§9) —
  // "loaded" is gated on THAT request settling, not the separate identity fetch.
  const { notes, loading: notesLoading, error: notesError, reload: reloadNotes, editNote } = usePopoutCustomerNotes(id)
  const { writableTypes } = useNoteTypes('customer')
  const combinedLoading = loading || notesLoading
  const loaded = !combinedLoading && !error && !notesError
  const retry = () => { reload(); reloadNotes() }

  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as EditableNote) : null

  // Sets the OS window title to the customer name while this popout is open, restoring the previous title on close.
  usePopoutWindowTitle(customer, t('common:popout.windowTitle', { name: customer?.name }))

  const notFound = loaded && (!note || isSystemNote(note))
  const labels: NotesLabels = { type: t('notes.type'), notePlaceholder: () => t('notes.notePlaceholder') }

  return (
    <PopoutShell
      loading={combinedLoading}
      error={Boolean(error) || notesError || !customer || notFound}
      onRetry={retry}
      loadingLabel={t('common:loading')}
      errorLabel={notFound ? t('common:popout.noteNotFound') : t('common:popout.loadError')}
      retryLabel={t('common:error.retry')}
      name={customer?.name ?? ''} initials={customer?.initials ?? ''} subtitle={t('notes.notes')}
    >
      {note && (
        <NoteEditor key={String(noteId)} note={note} managePermission="customers.notes.manage_all"
          onSave={payload => editNote(noteIndex, payload)}
          links={id && noteId ? { host: 'customers', hostId: id, noteId } : undefined}
          noteTypes={writableTypes} channels={[]} labels={labels} readOnlyCopy={t('common:popout.noteReadOnly')} />
      )}
    </PopoutShell>
  )
}

// --- Generic branch (vacancy · task · match · opportunity) -------------------
// One component for every entity whose notes ride the plain `{basePath}/notes/
// {id}` shape `useEntityNotes` already fetches/edits — see the file docblock
// for why these four qualify and customer/candidate/application don't.
// The uniform shape every entity's lite hook adapts down to for this component.
interface AdaptedLite { record: unknown; name: string; initials: string; subtitle?: string }
// The API plural per entity — kept next to the branch that uses it.
const ENTITY_API_BASE: Record<'vacancy' | 'task' | 'match' | 'opportunity', string> = {
  vacancy: '/vacancies', task: '/tasks', match: '/matches', opportunity: '/opportunities',
}

function GenericNoteEditPopout<R extends { loading: boolean; error: boolean; reload: () => void }>({ entity, i18nNs, useLite, adapt }: {
  entity: 'vacancy' | 'task' | 'match' | 'opportunity'
  i18nNs: 'vacancies' | 'tasks' | 'matches' | 'opportunities'
  useLite: (id: string | undefined) => R
  adapt: (r: R) => AdaptedLite
}) {
  const { id, noteId } = useParams()
  const { t } = useTranslation(i18nNs)
  const lite = useLite(id)
  const { record, name, initials, subtitle } = adapt(lite)
  const { loading, error, reload } = lite
  // Explicit per-entity API route + update method — never derived from the i18n
  // namespace (a coincidental coupling), and opportunities' route is PUT-only.
  // useEntityNotes fires its OWN GET `${basePath}/notes` (§9) — its loading/error
  // are read here (not discarded) so "note not found" only shows once the notes
  // request itself has actually settled, not just the identity fetch.
  const { notes, loading: notesLoading, error: notesError, fetchNotes, editNote } = useEntityNotes({ id, basePath: `${ENTITY_API_BASE[entity]}/${id}`, updateMethod: entity === 'opportunity' ? 'put' : 'patch' })
  const { writableTypes } = useNoteTypes(entity)
  const retry = () => { reload(); fetchNotes() }

  const noteIndex = notes.findIndex(n => String(n.id) === String(noteId))
  const note = noteIndex >= 0 ? (notes[noteIndex] as EditableNote) : null

  // Sets the OS window title to the record's identity while this popout is open, restoring the previous title on close.
  usePopoutWindowTitle(record, t('common:popout.windowTitle', { name }))

  return (
    <SimpleNotePopoutShell loading={loading} error={error} notesLoading={notesLoading} notesError={notesError} record={record} reload={retry}
      name={name} initials={initials} subtitle={subtitle}
      note={note} noteId={noteId} onSave={payload => editNote(noteIndex, payload)}
      managePermission="candidates.notes.manage_all" writableTypes={writableTypes} t={t} />
  )
}

// Inner editor — mounted only once the note exists (useNoteFields seeds ONCE at
// mount; the key above remounts it per note id, same recipe as the composer).
// Shared by EVERY entity branch (§11: one form, structural EditableNote input);
// each branch now hands it its own already-resolved `labels`/`readOnlyCopy`
// instead of a per-namespace switch living inside this shared body.
function NoteEditor({ note, onSave, noteTypes, channels, managePermission, labels, readOnlyCopy, links }: {
  note: EditableNote
  // The host's note-link routes (candidates/customers only) — omitted = no Koppelingen block.
  links?: { host: NoteLinkHost; hostId: Id; noteId: Id }
  onSave: (payload: { type: string; title: string; body: string; channel?: string; language?: string }) => Promise<boolean>
  noteTypes: NoteType[]
  channels: NoteType[]
  managePermission: string
  labels: NotesLabels
  readOnlyCopy: string
}) {
  const auth = useAuth()
  // ASSIST-SIDEPANEEL parity with the composer: the panel's item state +
  // known_items + the tenant's Auto/Wizard stand (r2 punt-3/10 gat).
  const [panelItems, setPanelItems] = useState<NoteActionPanelItem[]>([])
  const koios = useMyKoiosMode()
  const onAssistItems = (fresh: Parameters<typeof mergeNoteActionItems>[1]) =>
    setPanelItems(prev => mergeNoteActionItems(prev, fresh))
  const knownItems = useMemo(() => toKnownItems(panelItems), [panelItems])

  const fields = useNoteFields({
    type: typeof note.type === 'string' ? note.type : undefined,
    channel: typeof note.channel === 'string' ? note.channel : undefined,
    title: typeof note.title === 'string' ? note.title : undefined,
    body: typeof note.body === 'string' ? note.body : (typeof note.text === 'string' ? note.text : undefined),
    language: typeof note.language === 'string' ? note.language : undefined,
  }, noteTypes)

  // Same edit right the list applies (noteRights) — a pasted URL is not a licence.
  const editable = canManageNote(note, auth?.user?.id, auth?.hasPermission ?? (() => false), managePermission)
  const { t: tCommon } = useTranslation('common')

  // Read-only: someone else's note without the manage right — show, never edit (§7).
  if (!editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Typography/notice atom (§4): the one inline banner is CalloutBox — no local fontSize/border/background. */}
        <CalloutBox variant="info">{readOnlyCopy}</CalloutBox>
        <SafeHtml style={{ ...bodyTextStyle, color: 'var(--text)', lineHeight: 1.6 }} html={String(note.body ?? note.text ?? '')} />
      </div>
    )
  }

  return (
    // r2 punt-3/10 gat: the second screen diverged from the composer (old
    // append-as-text, no side panel) — it now mirrors the SAME panel wiring,
    // so "één implementatie" is true again.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <NoteFields fields={fields} noteTypes={noteTypes} channels={channels} labels={labels}
            noteId={typeof note.id === 'string' ? note.id : undefined} editorMinHeight={220}
            onItems={onAssistItems} knownItems={knownItems} />
          {/* Koppelingen (NOTITIE-DOORLINK-1 write side): chips + Koppelen picker + unlink, editor-only. */}
          {links && (
            <div style={{ marginTop: 12 }}>
              <GroupLabel as="div" style={{ marginBottom: 4 }}>{tCommon('notes.links.title')}</GroupLabel>
              <NoteLinksRow mode="edit" host={links.host} hostId={links.hostId} noteId={links.noteId} canManage={editable}
                initialLinks={(note.links ?? []).filter(l => l.is_manual)} />
            </div>
          )}
        </div>
        {panelItems.length > 0 && (
          <NoteActionsPanel items={panelItems} onItemsChange={setPanelItems}
            noteId={typeof note.id === 'string' ? note.id : undefined} autoRun={koios.mode === 'auto'} />
        )}
      </div>
      {/* The profile text's exact closing contract — shared footer (§11). */}
      <PopoutSaveFooter dirty={fields.dirty} onSave={() => onSave(fields.payload)} />
    </div>
  )
}
