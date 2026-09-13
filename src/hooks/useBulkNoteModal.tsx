/**
 * useBulkNoteModal — the shared "bulk add note" modal slot (NOTITIE-RTE-VRAAG-1:
 * bulk note opens the rich-text modal, never ActionMenu's bare input node). Owns
 * the open/close state and renders the shared BulkNoteModal with the entity's
 * `onAddNote` callback wired in — hand-copied identically across every bulk bar
 * (candidates/customers/…) before this consolidation.
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'
import BulkNoteModal from '@/components/ui/BulkNoteModal'

export function useBulkNoteModal(onAddNote: (html: string) => void, t: TFunction) {
  const [open, setOpen] = useState(false)
  const node = (
    <BulkNoteModal open={open} onClose={() => setOpen(false)}
      onSubmit={html => { onAddNote(html); setOpen(false) }}
      title={t('bulk.addNote')} submitLabel={t('bulk.noteSubmit')} />
  )
  return { open, setOpen, node }
}
