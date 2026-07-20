import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
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

/**
 * Communication tab — sub-tabs (Danny 2026-07-03, mirrors the Planning panel):
 * Toestemmingen · Taken · Notities · Tijdlijn · Conversaties. Each section renders
 * on its own; NotesTab is reused per-section via its show* flags (no duplication).
 */
export default function CommunicationTab({ c, onSave, onEditStatusEvent }: { c: Candidate; onSave?: (consent: Record<string, unknown>) => void
  // Optional (Danny 2026-07-20, job A): forwarded to the shared NotesTab so the
  // Tijdlijn "Statuswissel" row gets an edit pencil — only when the host (CandidateDrawer)
  // resolves the current status as reason/date-carrying. Additive prop, see NotesTab.
  onEditStatusEvent?: () => void }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Note categories from the tenant lookup, scoped to 'candidate' (NOTE-TYPES-2/3).
  const { types: allNoteTypes, writableTypes } = useNoteTypes('candidate')
  // Contact channels (last_contact_types) — picking one on a note stamps last_contact_at/_type/_by.
  const { types: channels } = useLastContactTypes()
  // Notes persist via the API (G-1) — add/edit/delete hit /candidates/{id}/notes.
  const { notes, addNote, editNote } = useCandidateNotes(c.id)

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
  const [subTab, setSubTab] = useState('notes')

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

  // Shared NotesTab props — each sub-tab renders exactly one of its sections.
  const notesProps = {
    notes: userNotes, onAddNote: addNote, onEditNote: editUserNote,
    timeline: c.timeline ?? [], systemNotes,
    noteTypes: writableTypes, chipTypes: allNoteTypes, channels, authorInitials: c.ownerInitials, timelineName: c.name,
    timelineInitials: c.initials,
    // Job A pencil on the "Statuswissel" timeline row — see the prop comment above.
    onEditStatusEvent,
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
