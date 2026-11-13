/**
 * TargetsSelectionHeader — the assign bars / select-all header above the call
 * list rows, moved verbatim out of TargetsTab (SIZE-TRIGGER-1).
 */
import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import AssignTargetsBar from './AssignTargetsBar'
import type { AssignResult } from '../hooks/useOutreachDetail'
import type { TargetSelection, AssigneeAxes } from '../data/outreachApi'

// BELLIJST-ASSIGN-2 — select-all + count header, plus the "assign everyone
// matching this filter" entry point once >=1 filter narrows the list.
export default function TargetsSelectionHeader({ assignAllFiltered, setAssignAllFiltered, currentFilters, visibleCount,
  selected, setSelected, recruiters, onAssignTargets, allSelected, toggleAll, hasAnyFilter }: {
  assignAllFiltered: boolean
  setAssignAllFiltered: (v: boolean) => void
  currentFilters: Record<string, unknown>
  visibleCount: number
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  recruiters: { value: string; label: string }[]
  onAssignTargets: (selection: TargetSelection, assignee: AssigneeAxes) => Promise<AssignResult>
  allSelected: boolean
  toggleAll: () => void
  hasAnyFilter: boolean
}) {
  const { t } = useTranslation('outreach')
  return (
  assignAllFiltered ? (
    <AssignTargetsBar selection={{ filters: currentFilters }} count={visibleCount}
      recruiters={recruiters} onAssign={onAssignTargets} onDone={() => setAssignAllFiltered(false)} />
  ) : selected.size > 0 ? (
    <AssignTargetsBar selection={{ ids: [...selected] }} count={selected.size}
      recruiters={recruiters} onAssign={onAssignTargets} onDone={() => setSelected(new Set())} />
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label={t('common:selectAll')} />
        <Caption>{t('common:selectAll')}</Caption>
      </div>
      {hasAnyFilter && (
        <Button variant="ghost" size="sm" onClick={() => setAssignAllFiltered(true)}>
          {t('drawer.assign.assignAllMatching', { count: visibleCount })}
        </Button>
      )}
    </div>
  )
  )
}
