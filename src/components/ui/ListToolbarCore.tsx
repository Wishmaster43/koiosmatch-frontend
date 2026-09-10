/**
 * ListToolbarCore — the "+ Add" button + HeaderSearch + ClearFiltersButton trio
 * that opens every list-page toolbar (candidates/customers/vacancies/opportunities/…)
 * once no rows are selected. Purely presentational, composition over configuration
 * (§3): the add button's own content (icon + label) and the search width stay the
 * caller's own, since callers differ (a literal "+" vs a Plus icon, 260/280/300px).
 */
import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'

interface ListToolbarCoreProps {
  // OPENERS-HIDE-1: the "+ Add" opener renders only when the reader holds the entity's create permission.
  canCreate: boolean
  onAdd: () => void
  // The add button's own content (icon + label) — never a fixed string, since
  // callers differ (literal "+ label" vs an icon component + label).
  addContent: ReactNode
  searchEpoch: number
  defaultSearch?: string
  onSearch: (v: string) => void
  searchPlaceholder: string
  searchWidth?: number
  anyFilterActive: boolean
  onClearFilters: () => void
}

// The add/search/clear trio shared by every list-page toolbar's idle state (see file header).
export default function ListToolbarCore({
  canCreate, onAdd, addContent, searchEpoch, defaultSearch, onSearch, searchPlaceholder, searchWidth = 300,
  anyFilterActive, onClearFilters,
}: ListToolbarCoreProps) {
  return (
    <>
      {canCreate && (
        <Button variant="primary" size="md" onClick={onAdd}>
          {addContent}
        </Button>
      )}
      <HeaderSearch key={searchEpoch} onSearch={onSearch} defaultValue={defaultSearch}
        placeholder={searchPlaceholder} width={searchWidth} />
      <ClearFiltersButton active={anyFilterActive} onClear={onClearFilters} />
    </>
  )
}
