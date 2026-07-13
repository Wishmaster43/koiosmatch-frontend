/**
 * CandidateLifecycleModals — thin wrapper bundling the three confirm/guard
 * popups CandidatesPage can raise around a candidate's lifecycle: the
 * deletion-preview (ERASE-1, permanent delete blast-radius) and the single +
 * bulk ArchiveGuardModal (§3B: never archive/prullenbak over a live
 * application or active match). Pulled out of CandidatesPage purely for size
 * discipline (§0.3, file cap) — no logic lives here, just composition.
 */
import DeletionPreviewModal from './drawer/DeletionPreviewModal'
import ArchiveGuardModal from './drawer/ArchiveGuardModal'
import type { ArchiveGuardTarget } from './hooks/useCandidateDrawerActions'
import type { BulkArchiveGuardTarget } from './hooks/useCandidateBulkActions'
import type { Id } from '@/types/common'

interface Props {
  eraseTarget: { id: Id; name: string } | null
  onCloseErase: () => void
  onConfirmErase: () => void
  archiveGuard: ArchiveGuardTarget | null
  onCloseArchiveGuard: () => void
  onResolveArchiveGuard: () => void
  bulkArchiveGuard: BulkArchiveGuardTarget | null
  onCloseBulkArchiveGuard: () => void
  onResolveBulkArchiveGuard: () => void
}

export default function CandidateLifecycleModals({
  eraseTarget, onCloseErase, onConfirmErase,
  archiveGuard, onCloseArchiveGuard, onResolveArchiveGuard,
  bulkArchiveGuard, onCloseBulkArchiveGuard, onResolveBulkArchiveGuard,
}: Props) {
  return (
    <>
      {/* Deletion-preview confirm popup (ERASE-1) — shows the blast radius before force-delete. */}
      {eraseTarget && (
        <DeletionPreviewModal candidateId={eraseTarget.id} candidateName={eraseTarget.name}
          onClose={onCloseErase} onConfirm={onConfirmErase} />
      )}

      {/* Archive-guard popup (§3B) — single-record: blocks archive/prullenbak while a
          live application or active match hangs on this candidate. */}
      {archiveGuard && (
        <ArchiveGuardModal mode={archiveGuard.mode} candidateName={archiveGuard.candidateName}
          applications={archiveGuard.applications} matches={archiveGuard.matches}
          onClose={onCloseArchiveGuard} onResolved={onResolveArchiveGuard} />
      )}
      {/* Same popup, bulk/aggregate mode — N of the selection are blocked. */}
      {bulkArchiveGuard && (
        <ArchiveGuardModal mode="archive"
          aggregate={{ blockedCount: bulkArchiveGuard.blockedCount, totalCount: bulkArchiveGuard.totalCount }}
          applications={bulkArchiveGuard.applications} matches={bulkArchiveGuard.matches}
          onClose={onCloseBulkArchiveGuard} onResolved={onResolveBulkArchiveGuard} />
      )}
    </>
  )
}
