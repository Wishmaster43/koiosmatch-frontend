import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, X } from 'lucide-react'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardBox } from '@/components/ui/modalCards'
import type { PendingFile } from './usePostCreateAttachments'

interface Props {
  files: PendingFile[]
  onAddFile: (file: File) => void
  onRemoveFile: (id: string) => void
  noteText: string
  onNoteChange: (v: string) => void
}

/**
 * AttachmentsCard — punten 21+22: pick documents and type one internal note
 * BEFORE the vacancy exists (both routes need a real id — usePostCreateAttachments
 * runs them right after Create succeeds). The assembler only renders this card
 * for a recruiter with `vacancies.update` (both routes need it next to
 * `vacancies.create`, measured) — this component only renders the pickers.
 * The note is its OWN rich-text block, distinct from the Vacaturetekst card
 * above it (the doubling lesson — never let two free-text fields blur together).
 */
export default function AttachmentsCard({ files, onAddFile, onRemoveFile, noteText, onNoteChange }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  const fileRef = useRef<HTMLInputElement>(null)
  // Purely presentational toggle state (mirrors DescriptionCard) — only the
  // note TEXT itself needs to be lifted for the submit/post-create sequence.
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [noteEditing, setNoteEditing] = useState(false)

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files
    if (picked) Array.from(picked).forEach(f => onAddFile(f))
    e.target.value = ''
  }

  // A+D layout (Danny 03-08): the heading now lives in the caller's CollapsedCard
  // title prop — this card renders only its own boxed body, no wrapper div.
  return (
    <div style={cardBox}>
      {/* Documents — picked now, uploaded right after Create returns the id. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            {t('drawer.tabs.documents')}
          </span>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> {t('common:add')}
          </button>
        </div>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button type="button" onClick={() => onRemoveFile(f.id)} title={t('common:remove')} aria-label={t('common:remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={onPick} aria-label={t('drawer.tabs.documents')} />
      </div>

      {/* Note — its own block, never merged with the Vacaturetekst above. */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('modal.attachments.noteLabel')}
        </div>
        <CollapsibleRichText t={t} value={noteText} onChange={onNoteChange}
          expanded={noteExpanded} setExpanded={setNoteExpanded} editing={noteEditing} setEditing={setNoteEditing}
          placeholder={t('modal.attachments.notePlaceholder')} ariaLabel={t('modal.attachments.noteLabel')} />
      </div>
    </div>
  )
}
