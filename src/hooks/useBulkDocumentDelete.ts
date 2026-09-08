import { useState } from 'react'
import type { EntityDoc } from '@/hooks/useEntityDocuments'

// Shared document deletion state and handlers — manages pending delete confirmation
// (one or many) and fires the appropriate callback once confirmed.
export function useBulkDocumentDelete(
  onConfirmOne: (doc: EntityDoc, index: number) => void,
  onConfirmMany: () => void
) {
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: 'one'; doc: EntityDoc; index: number } | { kind: 'many' } | null
  >(null)

  // File name shown in the single-delete confirm message (empty once dialog closes).
  const confirmDeleteName =
    confirmDelete?.kind === 'one'
      ? String(confirmDelete.doc.name ?? confirmDelete.doc.file_name ?? '')
      : ''

  // Run the staged single/bulk delete once confirmed.
  const confirmDeleteAction = () => {
    if (confirmDelete?.kind === 'one') {
      onConfirmOne(confirmDelete.doc, confirmDelete.index)
    } else if (confirmDelete?.kind === 'many') {
      onConfirmMany()
    }
    setConfirmDelete(null)
  }

  return {
    confirmDelete,
    setConfirmDelete,
    confirmDeleteName,
    confirmDeleteAction
  }
}
