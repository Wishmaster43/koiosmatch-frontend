import type { ReactNode } from 'react'
import { ListChecks } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import BulkBarShell from '@/components/ui/BulkBarShell'

interface BulkActionsBarProps {
  onClear: () => void
  items: MenuNode[]
  labels: {
    selected: string
    clear: string
    actions: string
  }
  children?: ReactNode
}

// Shared bulk-actions bar shell: renders the count label, clear button, and
// a drill-in actions menu. Used by all entity bulk bars (candidates, applications,
// tasks, matches, vacancies, customers, outreach) with entity-specific items and
// labels passed as props. Each caller keeps its own t() and item assembly.
// Optional children allow placing additional controls (scopes, modals) inside the bar.
export default function BulkActionsBar({
  onClear, items, labels, children,
}: BulkActionsBarProps) {
  return (
    <BulkBarShell label={labels.selected} onClear={onClear} clearLabel={labels.clear}>
      {items.length > 0 && <ActionMenu label={labels.actions} icon={ListChecks} items={items} />}
      {children}
    </BulkBarShell>
  )
}
