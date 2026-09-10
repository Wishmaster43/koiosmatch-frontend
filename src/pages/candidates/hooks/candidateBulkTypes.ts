/**
 * Shared parameter shape every candidate bulk-mutation cluster hook takes: the
 * checked selection, the toast notifier and i18n (§3 size split — every cluster
 * hook split out of useCandidateBulkActions redeclared the same three/four
 * fields, jscpd CANDHOOKS #3/#5/#7). Each cluster's own Params interface
 * extends this instead of repeating the fields; a cluster still adds whatever
 * extra it alone needs (candidates/setCandidates, notifyOutcome, …).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

// The checked-selection + toast machinery every bulk cluster receives from its
// parent useCandidateBulkActions, unchanged.
export interface CandidateBulkSelectionBase {
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
}
