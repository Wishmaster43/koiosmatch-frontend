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
import MergeCandidateModal from './drawer/MergeCandidateModal'
import type { ArchiveGuardTarget } from './hooks/useCandidateDrawerActions'
import type { BulkArchiveGuardTarget, BulkMergeTarget } from './hooks/useCandidateBulkActions'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

interface Props {
  eraseTarget: { id: Id; name: string } | null
  onCloseErase: () => void
  onConfirmErase: () => void
  archiveGuard: ArchiveGuardTarget | null
  onCloseArchiveGuard: () => void
  onResolveArchiveGuard: () => void
  // Live tenant funnel lookup (HERAUDIT-2-REST-b) — passed through to the
  // guard popup so its "resolve" step PATCHes the tenant's real rejected slug.
  funnelTypes?: LookupItem[]
  bulkArchiveGuard: BulkArchiveGuardTarget | null
  onCloseBulkArchiveGuard: () => void
  onResolveBulkArchiveGuard: () => void
  // Bulk-merge entry (punt 4) — opened from CandidatesBulkBar's "Samenvoegen…" when
  // exactly 2 rows are selected; onMerged reopens the survivor's drawer fresh.
  bulkMergeTarget: BulkMergeTarget | null
  onCloseBulkMerge: () => void
  onMergedBulk: (survivorId: Id) => void
}

// Composes the three confirm/guard popups a candidate lifecycle action can raise
// (erase preview, single/bulk archive guard, bulk merge) — pure wiring, no logic.
export default function CandidateLifecycleModals({
  eraseTarget, onCloseErase, onConfirmErase,
  archiveGuard, onCloseArchiveGuard, onResolveArchiveGuard, funnelTypes,
  bulkArchiveGuard, onCloseBulkArchiveGuard, onResolveBulkArchiveGuard,
  bulkMergeTarget, onCloseBulkMerge, onMergedBulk,
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
          applications={archiveGuard.applications} matches={archiveGuard.matches} funnelTypes={funnelTypes}
          onClose={onCloseArchiveGuard} onResolved={onResolveArchiveGuard} />
      )}
      {/* Same popup, bulk/aggregate mode — N of the selection are blocked. */}
      {bulkArchiveGuard && (
        <ArchiveGuardModal mode="archive"
          aggregate={{ blockedCount: bulkArchiveGuard.blockedCount, totalCount: bulkArchiveGuard.totalCount }}
          applications={bulkArchiveGuard.applications} matches={bulkArchiveGuard.matches} funnelTypes={funnelTypes}
          onClose={onCloseBulkArchiveGuard} onResolved={onResolveBulkArchiveGuard} />
      )}
      {/* Bulk-merge (punt 4) — prefilled with both selected rows, so it opens straight
          into the survivor choice instead of the search step. */}
      {bulkMergeTarget && (
        <MergeCandidateModal current={bulkMergeTarget.current} initialOther={bulkMergeTarget.other}
          onClose={onCloseBulkMerge} onMerged={onMergedBulk} />
      )}
    </>
  )
}
