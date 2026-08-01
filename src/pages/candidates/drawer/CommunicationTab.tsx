import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useAuth } from '@/context/AuthContext'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import SubTabBar from '@/components/drawer/SubTabBar'
import SectionCard from '@/components/ui/SectionCard'
import CandidateTasks from './CandidateTasks'
import ConversationsSection from './ConversationsSection'
import { useNoteTypes, SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useCandidateNotes } from '@/pages/candidates/hooks/useCandidateNotes'
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
export default function CommunicationTab({ c, onSave, onEditStatusEvent, initialSubTab }: { c: Candidate; onSave?: (consent: Record<string, unknown>) => void
  // Optional (Danny 2026-07-20, job A): forwarded to the shared NotesTab so the
  // Tijdlijn "Statuswissel" row gets an edit pencil — only when the host (CandidateDrawer)
  // resolves the current status as reason/date-carrying. Additive prop, see NotesTab.
  onEditStatusEvent?: () => void
  // Deep-link sub-tab target (table cell click); validated below against KNOWN_SUB_TABS.
  initialSubTab?: string }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Note categories from the tenant lookup, scoped to 'candidate' (NOTE-TYPES-2/3).
  const { types: allNoteTypes, writableTypes } = useNoteTypes('candidate')
  // Contact channels (last_contact_types) — picking one on a note stamps last_contact_at/_type/_by.
  const { types: channels } = useLastContactTypes()
  // Notes persist via the API (G-1) — add/edit/delete hit /candidates/{id}/notes.
  const { notes, addNote, editNote } = useCandidateNotes(c.id)
  // AVG-RET-2: the retention deadline exposes the erasure timeline, so gate it like
  // the rest of the erasure-adjacent UI (mirrors CandidatesPage's archive/merge gate
  // on candidates.delete) — hidden entirely without the permission, never blank.
  const canViewRetention = useAuth()?.hasPermission('candidates.delete') ?? false

  // SYSTEM notes (status/phase changes, BE-written) are EVENTS, not notes (Danny
  // 2026-07-13): they render in the Tijdlijn, never in the Notities thread. Keep the
  // original index on user notes so edits still hit the right row in the hook's list.
  const isSystem = (n: { type?: string; is_system?: unknown }) => Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))
  const indexed = notes.map((n, i) => ({ ...n, __idx: i }))
  const userNotes = indexed.filter(n => !isSystem(n))
  const systemNotes = indexed.filter(isSystem)
  const editUserNote = (fi: number, payload: { type: string; title: string; body: string; channel?: string }) =>
    editNote(userNotes[fi].__idx, payload)
  // Active sub-tab — notes is the daily surface, consent/tasks/timeline one click away.
  // Deep-link default: an unknown/stale target falls back to Notities rather than
  // blanking the tab — this component is the sub-tab validator.
  const [subTab, setSubTab] = useState(
    initialSubTab && (KNOWN_SUB_TABS as readonly string[]).includes(initialSubTab) ? initialSubTab : 'notes'
  )

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

  // Shared NotesTab props — each sub-tab renders exactly one of its sections.
  const notesProps = {
    notes: userNotes, onAddNote: addNote, onEditNote: editUserNote,
    timeline: c.timeline ?? [], systemNotes,
    noteTypes: writableTypes, chipTypes: allNoteTypes, channels, authorInitials: c.ownerInitials, timelineName: c.name,
    timelineInitials: c.initials,
    // Job A pencil on the "Statuswissel" timeline row — see the prop comment above.
    onEditStatusEvent,
    // Point 3 — see renderMatchTimeline above.
    renderTimelineContent: renderMatchTimeline,
    labels: {
      // No section titles (Danny addendum 4): notes/timeline/conversations each
      // render as the SOLE visible NotesTab section for their own sub-tab, whose
      // bar already carries that exact label ("Notities"/"Tijdlijn"/"Conversaties") —
      // an in-content heading would just repeat it. The *Empty strings still
      // show (they're the empty-state copy, not a title).
      notes: '',
      newNote: t('communication.newNote'),
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
                <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={!!on} onChange={e => setConsent(ch.key, e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{ch.label}</span>
                  {on && at && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('communication.consentGivenAt', { date: formatDate(at) })}</span>}
                </div>
              )
            })}

          </div>

          {/* AVG-bewaartermijn — its OWN clearly bounded block (Danny 24-07: the
              loose text line under the channel consents was unreadable). Titled
              sub-block: the opt-in toggle + a soft-tint status card. */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>
              {t('communication.retentionTitle')}
            </div>
            {/* Retention opt-in (Block B, AVG-RET-2) — a REAL toggle (CMBE-RET-A). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <input type="checkbox" checked={!!c.consent.retentionOptIn}
                onChange={e => setRetentionOptIn(e.target.checked)}
                aria-label={t('communication.consentRetentionOptIn')}
                style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{t('communication.consentRetentionOptIn')}</span>
              {c.consent.retentionOptIn && c.consent.retentionConsentAt && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('communication.consentGivenAt', { date: formatDate(c.consent.retentionConsentAt) })}
                </span>
              )}
            </div>
            {/* Read-only status card (Block A) — role-gated; soft-tint per state so
                "Onbeperkt bewaren" reads as a clear block, never a loose sentence. */}
            {canViewRetention && (() => {
              const state = c.retentionExpiresAt ? 'until' : (c.consent.retentionOptIn ? 'unlimited' : 'unknown')
              const tone = state === 'until' ? 'var(--color-info, var(--color-primary))' : state === 'unlimited' ? 'var(--color-success)' : 'var(--text-muted)'
              const label = state === 'until'
                ? t('communication.retentionUntil', { date: formatDate(c.retentionExpiresAt) })
                : state === 'unlimited'
                  ? t('communication.retentionUnlimited', { date: formatDate(c.consent.retentionConsentAt) })
                  : t('communication.retentionUnknown')
              return (
                <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: tone,
                  background: `color-mix(in srgb, ${tone} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${tone} 35%, transparent)` }}>
                  {label}
                </div>
              )
            })()}
          </div>
        </SectionCard>
      )}

      {/* Tasks linked to this candidate — click-through to the Taken page + "+ Taak". */}
      {subTab === 'tasks' && <CandidateTasks candidateId={c.id} />}

      {/* Notes / timeline / conversations — one NotesTab section per sub-tab. */}
      {subTab === 'notes'         && <NotesTab {...notesProps} showTimeline={false} showConversations={false} />}
      {subTab === 'timeline'      && <NotesTab {...notesProps} showNotes={false} showConversations={false} />}
      {subTab === 'conversations' && <ConversationsSection candidateId={c.id} />}
    </div>
  )
}
