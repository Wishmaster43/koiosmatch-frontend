/**
 * BulkNoteModal — NOTITIE-RTE-VRAAG-1 (Danny 27-08): the bulk "add note" action
 * opens this shared rich-text popup instead of ActionMenu's bare `input` textbox,
 * so a bulk note gets the same formatting affordance as every other note in the
 * app. Composes the ONE shared popup shell (FloatingPanel — POPUP-SLEEP-1:
 * draggable/resizable/maximizable) with the shared RichTextEditor body and
 * ModalFooter, exactly like the per-record note composer. Kept generic (no
 * note-specific fields) so any bulk bar can reuse it for its own onAddNote.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from './FloatingPanel'
import RichTextEditor from './RichTextEditor'
import ModalFooter from './ModalFooter'

export interface BulkNoteModalProps {
  open: boolean
  onClose: () => void
  // Called with the editor's HTML content once the user submits.
  onSubmit: (html: string) => void
  title: string
  submitLabel: string
  busy?: boolean
}

// Shared bulk-note popup: FloatingPanel shell + RichTextEditor body + ModalFooter.
export default function BulkNoteModal({ open, onClose, onSubmit, title, submitLabel, busy = false }: BulkNoteModalProps) {
  const { t } = useTranslation('common')
  const [html, setHtml] = useState('')

  // Reset the draft and close — a fresh open always starts empty.
  const handleClose = () => { setHtml(''); onClose() }
  // Submit only non-empty content; the caller's onAddNote handler runs the mutation.
  const handleSubmit = () => {
    if (!html || html === '<p></p>') return
    onSubmit(html)
    setHtml('')
  }

  return (
    // closeOnBackdrop={false}: this window holds UNSAVED typed/dictated work —
    // only the explicit close/cancel buttons may discard it (Danny 23-08).
    <FloatingPanel open={open} onClose={handleClose} title={title} ariaLabel={title}
      persistKey="bulk-note" width={640} maxWidth="92vw"
      scrollBody={false} closeOnBackdrop={false} maximizable>
      {/* The editor is the ONE growing item, so resizing grows the writing space. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '16px 24px', overflow: 'auto' }}>
        <RichTextEditor value={html} onChange={setHtml} minHeight={140} />
      </div>
      <ModalFooter onCancel={handleClose} onSubmit={handleSubmit}
        cancelLabel={t('cancel')} submitLabel={submitLabel} busy={busy} disabled={!html || html === '<p></p>'} />
    </FloatingPanel>
  )
}
