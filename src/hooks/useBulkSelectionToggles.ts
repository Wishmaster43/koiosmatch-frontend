/**
 * useBulkSelectionToggles — the row/select-all toggle pair every bulk-selection
 * hook wires against its own `selectedIds` state (candidates/customers/vacancies/
 * tasks/matches/applications/opportunities): same setSelectedIds updater
 * semantics everywhere, so this stays the one place that owns the Set mutation.
 */
import type { Dispatch, SetStateAction } from 'react'
import { toggleInSet, toggleAllInSet } from '@/lib/selectionSet'
import type { Id } from '@/types/common'

// Row/select-all toggles over a `Set<Id>` selection state (see file header).
export function useBulkSelectionToggles(setSelectedIds: Dispatch<SetStateAction<Set<Id>>>) {
  const toggleRow = (id: Id) => setSelectedIds(prev => toggleInSet(prev, id))
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => toggleAllInSet(prev, ids, allSelected))
  return { toggleRow, toggleAll }
}
