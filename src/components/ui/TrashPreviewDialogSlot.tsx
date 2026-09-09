import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'
import type { useTrashFlow } from '@/hooks/useTrashFlow'

type TrashFlowState = ReturnType<typeof useTrashFlow>

/**
 * Renders the shared "Definitief verwijderen" preview dialog (TRASH-OVERAL-2).
 * Used by WorkflowsPage, MatchesPage, OutreachPage — all three carry no
 * transferable owner (preview.transferable stays null), so the modal renders
 * without the transfer picker by itself.
 */
export default function TrashPreviewDialogSlot({ trash }: {
  trash: TrashFlowState
}) {
  return trash.target ? (
    <DeletionPreviewModal open onClose={trash.close} entityLabel={trash.target.label}
      preview={trash.preview} loading={trash.loading} error={trash.error}
      users={[]} onConfirm={trash.confirmMark} busy={trash.busy} blocked={trash.blocked}
      graceDays={trash.graceDays} />
  ) : null
}
