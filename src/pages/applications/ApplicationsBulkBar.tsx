/**
 * ApplicationsBulkBar — selection action bar shown above the table when ≥1
 * application is checked. One "bulk actions" menu (ActionMenu, drill-in): change
 * funnel phase + detach (danger, permission-gated). Thin assembler — options in
 * via props, the mutation runs in the page. Extend by adding a node.
 */
import { useTranslation } from 'react-i18next'
import { Milestone } from 'lucide-react'
import type { MenuNode } from '@/components/ui/ActionMenu'
import BulkActionsBar from '@/components/ui/BulkActionsBar'
import { detachNode } from '@/components/ui/bulk/bulkNodes'
import type { LookupOption } from '@/types/common'

interface ApplicationsBulkBarProps {
  count: number
  onClear: () => void
  onSetPhase: (phaseKey: string) => void
  onDetach: (reason: string) => void
  canManage?: boolean
  phases?: LookupOption[]
}

// See the file's top doc above for the bulk-actions menu this assembles; funnel options come from the tenant lookup, never hardcoded.
export default function ApplicationsBulkBar({ count, onClear, onSetPhase, onDetach, canManage = false, phases = [] }: ApplicationsBulkBarProps) {
  const { t } = useTranslation('applications')
  // Phase options from the funnel lookup (never hardcoded).
  const phaseOptions = phases.map(p => ({ value: p.value, label: p.label, color: p.color }))

  // Declarative action tree; detach only when the user may manage (server re-checks).
  // Heraudit-R2 finding 1: detach is an `input` node (mirrors CandidatesBulkBar's
  // note action) — the backend REQUIRES a `reason` on DELETE /applications/{id}
  // (S15), so a plain onSelect can never reach it; the drill-in collects the
  // reason and threads it through onSubmit → onDetach(reason).
  const items: MenuNode[] = [
    { key: 'phase', label: t('bulk.changePhase'), icon: Milestone,
      searchPlaceholder: t('bulk.searchPhase'), options: phaseOptions, onPick: v => onSetPhase(String(v)) },
    ...detachNode(t, { canManage, onDetach }),
  ]

  return (
    <BulkActionsBar
      onClear={onClear}
      items={items}
      labels={{ selected: t('bulk.selected', { count }), clear: t('bulk.deselect'), actions: t('bulk.actions') }}
    />
  )
}
