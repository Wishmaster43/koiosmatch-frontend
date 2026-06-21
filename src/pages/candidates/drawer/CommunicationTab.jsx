import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '../../../lib/datetime'
import NotesTab from '../../../components/drawer/tabs/NotesTab'
import EditableFieldTable from '../../../components/forms/EditableFieldTable'
import { NOTE_TYPES } from './constants'

const EDITOR_LABELS = {
  bold: 'Bold', italic: 'Italic', bulletList: 'Bullet list', orderedList: 'Numbered list',
  heading: 'Heading', alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
  undo: 'Undo', redo: 'Redo', expand: 'Expand', collapse: 'Collapse',
}

/** Communication tab — channel consent (AVG opt-in) + the candidate's notes/timeline. */
export default function CommunicationTab({ c, onSave }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [notes, setNotes] = useState(c.notes ?? [])

  // Channel consent (AVG opt-in) — WhatsApp / e-mail / newsletter, default off.
  // Field names match the backend's flat columns (whatsapp_consent, …).
  const consent = c.consent ?? {}
  const consentValue = {
    whatsapp_consent:   consent.whatsapp_consent   ?? false,
    email_consent:      consent.email_consent      ?? false,
    newsletter_consent: consent.newsletter_consent ?? false,
  }
  const consentFields = [
    { key: 'whatsapp_consent',   label: t('communication.consentWhatsapp'),   type: 'checkbox' },
    { key: 'email_consent',      label: t('communication.consentEmail'),      type: 'checkbox' },
    { key: 'newsletter_consent', label: t('communication.consentNewsletter'), type: 'checkbox' },
  ]
  // Read-only AVG audit line: when each granted consent was recorded server-side.
  const consentTimestamps = [
    { label: t('communication.consentWhatsapp'),   at: consent.whatsapp_consent_at },
    { label: t('communication.consentEmail'),      at: consent.email_consent_at },
    { label: t('communication.consentNewsletter'), at: consent.newsletter_consent_at },
  ].filter(x => x.at)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Consent toggles — persisted via the drawer's onUpdate ({ consent }). The
          existing `_at` timestamps are merged back so they survive the optimistic save. */}
      <div>
        <EditableFieldTable
          title={t('communication.consentTitle')}
          fields={consentFields}
          value={consentValue}
          labelWidth={220}
          onSave={v => onSave?.({ ...consent, ...v })}
        />
        {consentTimestamps.length > 0 && (
          <div style={{ marginTop: -10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {consentTimestamps.map(x => (
              <div key={x.label} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {x.label}: {t('communication.consentGivenAt', { date: formatDate(x.at) })}
              </div>
            ))}
          </div>
        )}
      </div>
      <NotesTab
        notes={notes}
        onAddNote={n => setNotes(p => [{ ...n, ago: t('common:justNow', { defaultValue: 'zojuist' }) }, ...p])}
        onEditNote={(i, n) => setNotes(p => p.map((x, idx) => idx === i ? { ...x, ...n } : x))}
        timeline={c.timeline ?? []}
        noteTypes={NOTE_TYPES.map(nt => ({ value: nt.value, label: t(`communication.noteTypes.${nt.key}`) }))}
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
          notePlaceholder: (typeLabel) => t('communication.notePlaceholder', { type: typeLabel }),
        }}
      />
    </div>
  )
}
