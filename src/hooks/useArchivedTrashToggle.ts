import type { Dispatch, SetStateAction } from 'react'

// The archived/trash quick views are mutually exclusive (TRASH-OVERAL-2): switching one
// on switches the other off. Shared by every list page that carries both toggles.
export function useArchivedTrashToggle(
  setShowArchived: Dispatch<SetStateAction<boolean>>,
  setShowTrash: Dispatch<SetStateAction<boolean>>,
) {
  const onToggleArchived = () => { setShowArchived(v => !v); setShowTrash(false) }
  const onToggleTrash = () => { setShowTrash(v => !v); setShowArchived(false) }
  return { onToggleArchived, onToggleTrash }
}
