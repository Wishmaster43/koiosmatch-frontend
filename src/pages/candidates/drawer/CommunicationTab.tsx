import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import SectionCard from '@/components/ui/SectionCard'
import { useNoteTypes } from '@/lib/useNoteTypes'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// Still-untyped JS components — accept any props at the boundary.
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

const EDITOR_LABELS = {
  bold: 'Bold', italic: 'Italic', bulletList: 'Bullet list', orderedList: 'Numbered list',
  heading: 'Heading', alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
  undo: 'Undo', redo: 'Redo', expand: 'Expand', collapse: 'Collapse',
}

/** Communication tab — channel consent (AVG opt-in) + the candidate's notes/timeline. */
export default function CommunicationTab({ c, onSave }: { c: Candidate; onSave?: (consent: Record<string, unknown>) => void }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Note categories from the tenant lookup (seed fallback until /note-types lands).
  const { types: noteTypes } = useNoteTypes()
  const [notes, setNotes] = useState<Record<string, unknown>[]>(c.notes ?? [])

  // Channel consent (AVG) — nested `consent.{channel}_*` (C-11). Toggling saves the
  // full consent object; the server stamps `*_consent_at` on a flip (shown inline).
  const consent = c.consent as unknown as Record<string, unknown>
  const CONSENT_CH = [
    { key: 'whatsapp_opt_in',   at: 'whatsapp_consent_at',   label: t('communication.consentWhatsapp'),   dflt: true },
    { key: 'email_opt_in',      at: 'email_consent_at',      label: t('communication.consentEmail'),      dflt: true },
    { key: 'newsletter_opt_in', at: 'newsletter_consent_at', label: t('communication.consentNewsletter'), dflt: false },
  ]
  const setConsent = (key: string, val: boolean) => onSave?.({ ...consent, [key]: val })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Consent toggles (AVG) — each channel shows its "given at" date+time inline. */}
      <SectionCard title={t('communication.consentTitle')}>
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
      <NotesTab
        notes={notes}
        onAddNote={(n: Record<string, unknown>) => setNotes(p => [{ ...n, created_at: new Date().toISOString(), ago: t('common:justNow', { defaultValue: 'zojuist' }) }, ...p])}
        onEditNote={(i: number, n: Record<string, unknown>) => setNotes(p => p.map((x, idx) => idx === i ? { ...x, ...n } : x))}
        timeline={c.timeline ?? []}
        noteTypes={noteTypes}
        authorInitials={c.ownerInitials}
        timelineName={c.name}
        timelineInitials={c.initials}
        editorLabels={EDITOR_LABELS}
        labels={{
          notes: t('sections.notes'),
          newNote: t('communication.newNote'),
          type: t('communication.type'),
          save: t('common:save'),
          cancel: t('common:cancel'),
          notesEmpty: t('sections.notesEmpty'),
          timeline: t('sections.timeline'),
          timelineEmpty: t('sections.timelineEmpty'),
          conversations: t('sections.conversations'),
          conversationsEmpty: t('sections.conversationsEmpty'),
          notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }),
        }}
      />
    </div>
  )
}
