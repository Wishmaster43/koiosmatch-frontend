import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Briefcase } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import SubTabBar from '@/components/drawer/SubTabBar'
import SectionCard from '@/components/ui/SectionCard'
import Toggle from '@/components/ui/Toggle'
import RetentionConsentBlock from './RetentionConsentBlock'
import CandidateTasks from './CandidateTasks'
import ConversationsSection from '@/components/drawer/ConversationsSection'
import DrawerAddButton from './DrawerAddButton'
import StartConversationModal from './StartConversationModal'
import { useNoteTypes, SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useCandidateNotes } from '@/pages/candidates/hooks/useCandidateNotes'
import { mergeTimelineEvents } from './mergeTimelineEvents'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// Still-untyped JS components — accept any props at the boundary.
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// MATCH-TIMELINE-EVENT-1 (point 3): resolves the match.created context fields from
// a raw timeline item, tolerant of either shape — nested under `context`/`payload`
// or flattened directly onto the event — since the exact wire shape isn't final
// yet (CMBE ticket). Returns null for every OTHER timeline item, so nothing
// renders differently until the backend actually ships the event.
function matchContext(ev: Record<string, unknown>): Record<string, unknown> | null {
  const ctx = (ev.context ?? ev.payload ?? ev) as Record<string, unknown>
  const isMatch = ev.type === 'match.created' || typeof ctx.customer_name === 'string'
  return isMatch ? ctx : null
}

// Known sub-tab ids (deep-link validation lives here, not in the drawer).
const KNOWN_SUB_TABS = ['conversations', 'notes', 'tasks', 'timeline', 'consent'] as const

/**
 * Communication tab — sub-tabs (Danny 2026-07-03, mirrors the Planning panel):
 * Toestemmingen · Taken · Notities · Tijdlijn · Conversaties. Each section renders
 * on its own; NotesTab is reused per-section via its show* flags (no duplication).
 */
export default function CommunicationTab({ c, onSave, onEditStatusEvent, initialSubTab, onRefresh }: { c: Candidate; onSave?: (consent: Record<string, unknown>) => void
  // Optional (Danny 2026-07-20, job A): forwarded to the shared NotesTab so the
  // Tijdlijn "Statuswissel" row gets an edit pencil — only when the host (CandidateDrawer)
  // resolves the current status as reason/date-carrying. Additive prop, see NotesTab.
  onEditStatusEvent?: () => void
  // LAST-CONTACT-REFRESH-1: pure record refresh (never a PATCH) — a channel-note
  // stamps last_contact server-side; this pulls the fresh stamp into the drawer.
  onRefresh?: (id: Candidate['id']) => Promise<void> | void
  // Deep-link sub-tab target (table cell click); validated below against KNOWN_SUB_TABS.
  initialSubTab?: string }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Note categories from the tenant lookup, scoped to 'candidate' (NOTE-TYPES-2/3).
  const { types: allNoteTypes, writableTypes } = useNoteTypes('candidate')
  // Contact channels (last_contact_types) — picking one on a note stamps last_contact_at/_type/_by.
  const { types: channels } = useLastContactTypes()
  // Notes persist via the API (G-1) — add/edit/delete hit /candidates/{id}/notes.
  const { notes, addNote, editNote, deleteNote } = useCandidateNotes(c.id, { onContactStamped: () => onRefresh?.(c.id) })

  // SYSTEM notes (status/phase changes, BE-written) are EVENTS, not notes (Danny
  // 2026-07-13): they render in the Tijdlijn, never in the Notities thread. Keep the
  // original index on user notes so edits still hit the right row in the hook's list.
  const isSystem = (n: { type?: string; is_system?: unknown }) => Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))
  const indexed = notes.map((n, i) => ({ ...n, __idx: i }))
  const userNotes = indexed.filter(n => !isSystem(n))
  const systemNotes = indexed.filter(isSystem)
  const editUserNote = (fi: number, payload: { type: string; title: string; body: string; channel?: string }) =>
    editNote(userNotes[fi].__idx, payload)
  // RECHTEN-NOTES-1: same filtered-index remap as edit — NotesTab hands the USER-list
  // index, the hook wants the full-thread index.
  const deleteUserNote = (fi: number) => deleteNote(userNotes[fi].__idx)
  // Active sub-tab — notes is the daily surface, consent/tasks/timeline one click away.
  // Deep-link default: an unknown/stale target falls back to Notities rather than
  // blanking the tab — this component is the sub-tab validator.
  const [subTab, setSubTab] = useState(
    initialSubTab && (KNOWN_SUB_TABS as readonly string[]).includes(initialSubTab) ? initialSubTab : 'notes'
  )

  // WHATSAPP-COMPOSE-1: "Conversatie starten" modal + a remount key that forces
  // ConversationsSection's own load effect to refetch once a new thread exists
  // (the shared component owns its fetch; a fresh key is the simplest "reload" a
  // caller can ask for without adding a second refetch contract to it).
  const [showStartModal, setShowStartModal] = useState(false)
  const [convRefreshKey, setConvRefreshKey] = useState(0)

  // Channel consent (AVG) — nested `consent.{channel}_*` (C-11). Toggling saves the
  // full consent object; the server stamps `*_consent_at` on a flip (shown inline).
  const consent = c.consent as unknown as Record<string, unknown>
  const CONSENT_CH = [
    { key: 'whatsapp_opt_in',   at: 'whatsapp_consent_at',   label: t('communication.consentWhatsapp'),   dflt: true },
    { key: 'email_opt_in',      at: 'email_consent_at',      label: t('communication.consentEmail'),      dflt: true },
    { key: 'newsletter_opt_in', at: 'newsletter_consent_at', label: t('communication.consentNewsletter'), dflt: false },
  ]
  // Optimistic "given at" (Danny punt F, live finding): the server DOES stamp
  // {channel}_consent_at on a flip, but buildCandidatePatch only ever forwards the
  // *_opt_in flags to the API (candidatesShared.ts) — the `_at` keys we set here
  // never reach the request body, they only make the date show up immediately
  // instead of waiting for the drawer to reopen. Toggling OFF nulls the local
  // date too, so an unchecked box never shows a stale "gegeven op".
  const setConsent = (key: string, val: boolean) => {
    const atKey = CONSENT_CH.find(ch => ch.key === key)?.at
    onSave?.({ ...consent, [key]: val, ...(atKey ? { [atKey]: val ? new Date().toISOString() : null } : {}) })
  }
  // Retention opt-in (Block B, AVG-RET-2) — CMBE-RET-A shipped the backend validation
  // (consent.retention_opt_in now persists), so this behaves exactly like the 3
  // channel toggles above: same optimistic "given at" stamp, no more honest-gate.
  // Uses the camelCase field names mapCandidate.ts already produces (retentionOptIn/
  // retentionConsentAt) — buildCandidatePatch maps them to the snake_case API keys.
  const setRetentionOptIn = (val: boolean) =>
    onSave?.({ ...consent, retentionOptIn: val, retentionConsentAt: val ? new Date().toISOString() : null })

  // MATCH-TIMELINE-EVENT-1 (point 3, Danny live P1): a "Geplaatst bij …" card for a
  // match.created timeline event — every part is optional and skipped cleanly
  // (never a dangling separator), mirroring the CandidateTasks createdLine idiom.
  // Returns null for every OTHER timeline item, so NotesTab falls back to the
  // plain `ev.text`/`ev.description` line unchanged (honest gate: nothing renders
  // differently until the backend actually ships the event).
  const renderMatchTimeline = (ev: Record<string, unknown>) => {
    // B24-TAB: application events get a small Briefcase icon so the merged Tijdlijn
    // reads which kind of event a row is at a glance (icon + text, never colour-only, §6).
    if (ev.kind === 'application') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <Briefcase size={13} style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          <div>
            <div>{ev.text as string}</div>
            {typeof ev.meta === 'string' && ev.meta && (
              <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>{ev.meta}</div>
            )}
          </div>
        </div>
      )
    }
    const ctx = matchContext(ev)
    if (!ctx) return null
    const customer = typeof ctx.customer_name === 'string' ? ctx.customer_name : undefined
    const location = typeof ctx.location_name === 'string' ? ctx.location_name : undefined
    const contractType = typeof ctx.contract_type === 'string' ? ctx.contract_type : undefined
    const start = typeof ctx.start_date === 'string' ? ctx.start_date : undefined
    const end = typeof ctx.end_date === 'string' ? ctx.end_date : undefined
    const via = (typeof ctx.recruiter_name === 'string' && ctx.recruiter_name)
      || (typeof ctx.contact_name === 'string' ? ctx.contact_name : undefined)

    const title = [customer ? t('communication.timelinePlacedAt', { customer }) : null, location]
      .filter(Boolean).join(' — ')
    const dateRange = start ? `${formatDate(start)} – ${end ? formatDate(end) : t('communication.timelineOngoing')}` : null
    const meta = [contractType, dateRange, via ? t('communication.timelineVia', { name: via }) : null]
      .filter(Boolean).join(' · ')

    if (!title && !meta) return null // flagged but genuinely empty — fall back to the plain line
    return (
      <>
        <div>{title}</div>
        {meta && <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>{meta}</div>}
      </>
    )
  }

  // B24-TAB: application/funnel events, mapped to the shared TimelineEvent shape
  // (`kind: 'application'`) so mergeTimelineEvents can interleave them with the
  // status/system events already carried on c.timeline — one chronological read
  // instead of two disjoint lists. Tolerant of the untyped `Loose` application
  // shape; an application with no usable date sorts last (never crashes/jumps top).
  const applicationEvents = (c.applications ?? []).map((app, i) => {
    const a = app as Record<string, unknown>
    const vacancy = (a.vacancy as Record<string, unknown> | undefined)
    const title = (typeof a.vacancy_title === 'string' && a.vacancy_title)
      || (typeof vacancy?.title === 'string' ? vacancy.title : undefined)
      || (typeof a.function_title === 'string' ? a.function_title : undefined)
    const stage = typeof a.funnel_stage_label === 'string' ? a.funnel_stage_label
      : (typeof a.stage === 'string' ? a.stage : undefined)
    return {
      id: `app-${(a.id as string | number | undefined) ?? i}`,
      kind: 'application' as const,
      time: (a.created_at as string | undefined) ?? (a.updated_at as string | undefined),
      // Title built with plain concatenation (not t() interpolation) so the value
      // is never swallowed by a raw-key i18n test double, mirroring renderMatchTimeline.
      text: title ? `${t('communication.timelineApplication')} ${title}` : t('communication.timelineApplicationGeneric'),
      meta: stage,
    }
  })
  // Chronological merge (B24-TAB) — status/system events (c.timeline) interleaved
  // with application events, newest-first, via the tested mergeTimelineEvents util.
  const mergedTimeline = useMemo(
    () => mergeTimelineEvents(c.timeline ?? [], applicationEvents),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- c.timeline/applications are new arrays per parent render; length is a cheap-enough proxy to avoid re-sorting every keystroke elsewhere in the drawer.
    [c.timeline, c.applications],
  )

  // Shared NotesTab props — each sub-tab renders exactly one of its sections.
  const notesProps = {
    notes: userNotes, onAddNote: addNote, onEditNote: editUserNote, onDeleteNote: deleteUserNote,
    timeline: mergedTimeline, systemNotes,
    noteTypes: writableTypes, chipTypes: allNoteTypes, channels, authorInitials: c.ownerInitials, timelineName: c.name,
    timelineInitials: c.initials,
    // Job A pencil on the "Statuswissel" timeline row — see the prop comment above.
    onEditStatusEvent,
    // Point 3 — see renderMatchTimeline above.
    renderTimelineContent: renderMatchTimeline,
    // F5 second-screen: which record the shared tab may pop out (named window —
    // reopening focuses the existing one). Since NOTITIE-POPOUT-HANDOFF-1 the tab
    // owns opening it, the blocked-popup notice AND handing a half-typed note over,
    // so this host only names the target.
    popout: { entity: 'candidate' as const, id: String(c.id) },
    labels: {
      // No section titles (Danny addendum 4): notes/timeline/conversations each
      // render as the SOLE visible NotesTab section for their own sub-tab, whose
      // bar already carries that exact label ("Notities"/"Tijdlijn"/"Conversaties") —
      // an in-content heading would just repeat it. The *Empty strings still
      // show (they're the empty-state copy, not a title).
      notes: '',
      newNote: t('communication.newNote'),
      deleteNote: t('communication.deleteNote'), deleteConfirm: t('communication.deleteConfirm'),
      type: t('communication.type'),
      channel: t('communication.channel'),
      channelNone: t('communication.channelNone'),
      save: t('common:save'),
      cancel: t('common:cancel'),
      notesEmpty: t('sections.notesEmpty'),
      timeline: '',
      timelineEmpty: t('sections.timelineEmpty'),
      conversations: '',
      conversationsEmpty: t('sections.conversationsEmpty'),
      notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }),
      openChangelog: t('drawer.changelog'),
      editStatusEvent: t('drawer.editStatusReason'),
      searchPlaceholder: t('communication.searchPlaceholder'),
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Sub-tab strip — same shared bar as the Planning panel; order per Danny 2026-07-03. */}
      <SubTabBar
        tabs={[
          { id: 'conversations', label: t('sections.conversations') },
          { id: 'notes',         label: t('sections.notes') },
          { id: 'tasks',         label: t('drawer.tasksTitle') },
          { id: 'timeline',      label: t('sections.timeline') },
          { id: 'consent',       label: t('communication.consentTitle') },
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {/* Consent toggles (AVG) — each channel shows its "given at" date+time inline.
          No title (Danny addendum 4): the sub-tab bar already says "Toestemmingen". */}
      {subTab === 'consent' && (
        <SectionCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CONSENT_CH.map(ch => {
              const on = (consent[ch.key] as boolean | undefined) ?? ch.dflt
              const at = consent[ch.at] as string | null | undefined
              return (
                // House toggle (Danny live review, 04-08: "Vervangen door
                // toggles!!" — a raw checkbox is never the house control, §0/§4).
                <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle checked={!!on} onChange={v => setConsent(ch.key, v)} ariaLabel={ch.label} />
                  <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{ch.label}</span>
                  {on && at && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('communication.consentGivenAt', { date: formatDate(at) })}</span>}
                </div>
              )
            })}

          </div>

          {/* AVG-bewaartermijn — its OWN clearly bounded block (Danny 24-07: the
              loose text line under the channel consents was unreadable). The consent's
              own validity (it LAPSES, Danny 2026-08-02) lives in RetentionConsentBlock. */}
          <RetentionConsentBlock
            optIn={!!c.consent.retentionOptIn}
            consentAt={c.consent.retentionConsentAt ?? null}
            expiresAt={c.retentionExpiresAt ?? null}
            onToggle={setRetentionOptIn}
          />
        </SectionCard>
      )}

      {/* Tasks linked to this candidate — click-through to the Taken page + "+ Taak". */}
      {subTab === 'tasks' && <CandidateTasks candidateId={c.id} />}

      {/* Notes / timeline / conversations — one NotesTab section per sub-tab. */}
      {subTab === 'notes'         && <NotesTab {...notesProps} showTimeline={false} showConversations={false} />}
      {subTab === 'timeline'      && <NotesTab {...notesProps} showNotes={false} showConversations={false} />}
      {subTab === 'conversations' && (
        <>
          {/* WHATSAPP-COMPOSE-1: no mobile number → an honest disabled trigger, never
              a dead send (a cold-start template requires a real recipient number). */}
          {showStartModal && (
            <StartConversationModal candidateId={c.id} onClose={() => setShowStartModal(false)}
              onStarted={() => setConvRefreshKey(k => k + 1)} />
          )}
          <ConversationsSection key={convRefreshKey} threadsUrl="/conversations" threadsParams={{ candidate_id: c.id }}
            headerAction={
              <DrawerAddButton onClick={() => setShowStartModal(true)} icon={MessageCircle}
                label={t('conversations.start')} disabled={!c.mobile}
                title={c.mobile ? t('conversations.start') : t('conversations.startNoMobile')} />
            } />
        </>
      )}
    </div>
  )
}
