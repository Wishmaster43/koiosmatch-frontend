import type { ReactNode } from 'react'
import MergeSubEntityModal from './MergeSubEntityModal'
import SubEntityArchiveDialogs from './SubEntityArchiveDialogs'
import { mergeModalCallbacks } from '../hooks/mergeModalCallbacks'
import type { MergeSubEntityScope, MergeCandidate } from './MergeSubEntityModal'
import type { Id } from '@/types/common'

interface SubEntityMergeFooterProps {
  scope: MergeSubEntityScope
  customerId: Id | null | undefined
  merging: boolean
  setMerging: (open: boolean) => void
  onMerged?: (survivorId: Id) => void
  current: MergeCandidate
  others: MergeCandidate[]
  dialog: ReactNode
  blockedCounts: Record<string, number> | null
  setBlockedCounts: (counts: Record<string, number> | null) => void
  archiveNow: () => Promise<void>
  archiving: boolean
}

/**
 * SubEntityMergeFooter — the optional MergeSubEntityModal plus the shared
 * SubEntityArchiveDialogs tail, byte-identical in DepartmentDetail and
 * LocationDetail (DRY round, CANDTABS package) bar the scope/current/others
 * each caller resolves for itself. ContactDetail has no merge modal, so it
 * stays on its own bare `<SubEntityArchiveDialogs>` — not a third consumer here.
 */
export default function SubEntityMergeFooter({
  scope, customerId, merging, setMerging, onMerged, current, others,
  dialog, blockedCounts, setBlockedCounts, archiveNow, archiving,
}: SubEntityMergeFooterProps) {
  return (
    <>
      {merging && customerId != null && (
        <MergeSubEntityModal scope={scope} customerId={customerId}
          current={current} others={others}
          {...mergeModalCallbacks(setMerging, onMerged)} />
      )}
      <SubEntityArchiveDialogs dialog={dialog} blockedCounts={blockedCounts} setBlockedCounts={setBlockedCounts}
        archiveNow={archiveNow} archiving={archiving} />
    </>
  )
}
