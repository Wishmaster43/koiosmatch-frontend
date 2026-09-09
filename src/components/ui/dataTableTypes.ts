import type { RefObject } from 'react'
import type { RowId, ControlledSort } from '@/components/ui/DataTable'

// Re-exported so a consumer can import the sort type from this module alone.

/**
 * Shared selection + sort + virtualization props for table components.
 * Used by CandidatesTable, VacanciesTable, ApplicationsTable, TasksTable.
 */
export interface TableSelectionProps {
  selectable?: boolean
  selectedIds?: Set<RowId>
  onToggleRow?: (id: RowId) => void
  onToggleAll?: (ids: RowId[], allSelected: boolean) => void
  // SELECT-RACE-1: while the caller's list query is fetching (background refetch),
  // the header checkbox goes inert.
  selectionBusy?: boolean
}

/**
 * Shared sort props for controlled sorting (DATATABLE-SORT-1).
 */
export interface TableSortProps {
  sort?: ControlledSort | null
  onSortChange?: (sort: ControlledSort) => void
}

/**
 * Shared virtualization prop for tables.
 */
export interface TableVirtualizationProps {
  // The vertical scroll container the table sits in.
  scrollParentRef?: RefObject<HTMLElement | null>
}
