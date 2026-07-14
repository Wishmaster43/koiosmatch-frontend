/**
 * CustomerNotesTab — sub-tabs (Danny 2026-07-14, mirrors candidates/drawer/
 * CommunicationTab.tsx): Notities · Tijdlijn. The shared NotesTab renders once
 * per sub-tab via its show* flags, exactly like the candidate tab — same
 * composer, same note-card look (type chip + author + pencil).
 *
 * "Gesprekken" is deliberately NOT included: NotesTab's conversations section
 * is a permanent stub across the WHOLE app today (no `conversations` data prop
 * exists anywhere, just a fixed empty-state string) — there is no customer (or
 * any entity) conversations endpoint yet, so adding the sub-tab would only ever
 * render empty. Report this as a finding, not a customer-specific gap.
 *
 * Tijdlijn is fed from the SAME audit-trail endpoint the changelog-icon popover
 * already uses (GET /customers/{id}/activity) — Customer carries no separate
 * embedded `timeline` array the way Candidate does (candidates get theirs
 * straight from GET /candidates/{id}).
 */
import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import SubTabBar from '@/components/drawer/SubTabBar'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import type { Id } from '@/types/common'
import type { CustomerNote } from '@/types/customer'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helper — accept any props at the boundary (mirrors CommunicationTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

interface TimelineEntry { time?: string; text?: string }
interface ActivityEntry { description?: string; action?: string; created_at?: string }

const EDITOR_LABELS = {
  bold: 'Bold', italic: 'Italic', bulletList: 'Bullet list', orderedList: 'Numbered list',
  heading: 'Heading', alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
  undo: 'Undo', redo: 'Redo', expand: 'Expand', collapse: 'Collapse',
}

interface Props {
  customerId: Id | undefined
  // Timeline identity — the customer itself (mirrors the candidate tab's own
  // timelineName/timelineInitials, which are the CANDIDATE's, not the author's).
  customerName?: string
  customerInitials?: string
  // Fallback avatar for a note with no resolved author on the API row — the
  // signed-in user (mirrors the previous inline NotesTab usage in this drawer).
  authorInitials?: string
  notes: CustomerNote[]
  onAddNote?: (payload: { type: string; title: string; body: string }) => void
}

export default function CustomerNotesTab({ customerId, customerName, customerInitials, authorInitials, notes, onAddNote }: Props) {
  const { t } = useTranslation('customers')
  // Note categories from the tenant lookup (mirrors CommunicationTab); writable
  // list for the composer, the full list for chip-label resolution.
  const { writableTypes: noteTypes, types: chipTypes } = useNoteTypes()
  const [subTab, setSubTab] = useState('notes')
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])

  // Fetch the activity feed lazily, only once the Tijdlijn sub-tab is opened.
  useEffect(() => {
    if (subTab !== 'timeline' || !customerId) return
    const ctrl = new AbortController()
    api.get(`/customers/${customerId}/activity`, { signal: ctrl.signal })
      .then(r => setTimeline(((r.data?.data ?? r.data ?? []) as ActivityEntry[])
        .map(ev => ({ time: ev.created_at, text: ev.description ?? ev.action ?? '' }))))
      .catch(e => { if (!isAbortError(e)) setTimeline([]) })
    return () => ctrl.abort()
  }, [subTab, customerId])

  // Shared NotesTab props — each sub-tab renders exactly one of its sections.
  const notesProps = {
    notes, onAddNote, timeline, noteTypes, chipTypes,
    authorInitials, timelineName: customerName, timelineInitials: customerInitials,
    editorLabels: EDITOR_LABELS,
    labels: {
      notes: t('notes.notes'), newNote: t('notes.newNote'), type: t('notes.type'),
      save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
      notesEmpty: t('notes.notesEmpty'), timeline: t('notes.timeline'), timelineEmpty: t('notes.timelineEmpty'),
      notePlaceholder: () => t('notes.notePlaceholder'),
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Sub-tab strip — same shared bar as the candidate Communicatie tab. */}
      <SubTabBar
        tabs={[
          { id: 'notes',    label: t('notes.notes') },
          { id: 'timeline', label: t('notes.timeline') },
        ]}
        active={subTab}
        onChange={setSubTab}
      />
      {subTab === 'notes'    && <NotesTab {...notesProps} showTimeline={false} showConversations={false} />}
      {subTab === 'timeline' && <NotesTab {...notesProps} showNotes={false} showConversations={false} />}
    </div>
  )
}
