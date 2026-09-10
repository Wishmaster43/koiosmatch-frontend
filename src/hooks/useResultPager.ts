// Browse (Danny 05-08): prev/next through the CURRENT result list, reusing the
// shared DrillPager anatomy (mirrors LocationDetail/ContactDetail). Disabled at
// the ends — no cycling, and undefined (never a no-op handler) is what makes
// DrillPager itself render the button disabled.
import type { Id } from '@/types/common'
import type { SearchableRow } from '@/components/drawer/search/useSearchSelection'

export function useResultPager<T extends SearchableRow>(rows: T[], selectedId: Id | null, selectId: (id: Id) => void) {
  const selectedIndex = rows.findIndex(r => r.id === selectedId)
  const goPrev = selectedIndex > 0 ? () => selectId(rows[selectedIndex - 1].id) : undefined
  const goNext = selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => selectId(rows[selectedIndex + 1].id) : undefined
  return { selectedIndex, goPrev, goNext }
}
