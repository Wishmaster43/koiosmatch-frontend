import { useTranslation } from 'react-i18next'
import NotesTab from '../../../components/drawer/tabs/NotesTab'
import { NOTE_TYPES } from './constants'

const EDITOR_LABELS = {
  bold: 'Bold', italic: 'Italic', bulletList: 'Bullet list', orderedList: 'Numbered list',
  heading: 'Heading', alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
  undo: 'Undo', redo: 'Redo', expand: 'Expand', collapse: 'Collapse',
}

/** Communication tab — wires the candidate's notes/timeline into the generic NotesTab. */
export default function CommunicationTab({ c }) {
  const { t } = useTranslation('candidates')
  return (
    <NotesTab
      notes={c.notes ?? []}
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
  )
}
