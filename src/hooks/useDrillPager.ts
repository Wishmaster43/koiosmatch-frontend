import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import type { Id } from '@/types/common'

// 1-based position of the OPEN record within `visible`, and the prev/next callbacks for
// DrillPagerProps. Undefined when the open record fell out of `visible` (e.g. an edit
// changed its status while a filter is active) — nothing sane to page to then
// (DRILL-PAGER-1, shared verbatim between ContactsPanel and DepartmentsPanel).
export function useDrillPager<T extends { id: Id | undefined }>(
  visible: T[],
  selected: T | null,
  onOpenChange: (id: Id) => void,
): DrillPagerProps | undefined {
  const openIndex = selected ? visible.findIndex(r => String(r.id) === String(selected.id)) : -1
  if (openIndex < 0) return undefined
  return {
    index: openIndex + 1,
    total: visible.length,
    onPrev: openIndex > 0 ? () => onOpenChange(visible[openIndex - 1].id as Id) : undefined,
    onNext: openIndex < visible.length - 1 ? () => onOpenChange(visible[openIndex + 1].id as Id) : undefined,
  }
}
