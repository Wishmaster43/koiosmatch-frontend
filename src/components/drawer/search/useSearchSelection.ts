// Shared selection state for search tabs (candidate-side vacancy search + vacancy-side candidate search).
// Tracks selectedId, resets on parent entity change, derives selectedRow from the list.
import { useState } from 'react'
import type { Id } from '@/types/common'

// Minimal interface for rows that can be selected — just requires an id field.
export interface SearchableRow {
  id: Id
}

export function useSearchSelection<T extends SearchableRow>(parentId: Id, rows: T[]) {
  // Selection state — the id of the currently-open summary card row.
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  // Reset selection on parent entity change (candidate→candidate or vacancy→vacancy switch).
  const [prevParentId, setPrevParentId] = useState(parentId)
  if (parentId !== prevParentId) { setPrevParentId(parentId); setSelectedId(null) }

  // Derive the selected row from the current list (null if not found or no selection).
  const selectedRow = rows.find(r => r.id === selectedId) ?? null

  // Select a row by id (used as click handler on list rows).
  const selectId = (id: Id) => setSelectedId(id)

  // Clear the selection (used by summary card's onClose handler).
  const clearSelection = () => setSelectedId(null)

  return { selectedId, selectedRow, selectId, clearSelection }
}
