/**
 * listViewOptions — the table/board ViewModeToggle option pair shared by every
 * list page that offers a board view (tasks/opportunities/matches/applications/
 * outreach). Same two icons everywhere; only the table label's i18n key differs
 * (MatchesPage labels its table option `view.matches`, not `view.table`).
 */
import { LayoutList, Kanban } from 'lucide-react'
import type { ViewModeOption } from '@/components/ui/ViewModeToggle'

// The table/board option pair for ViewModeToggle (see file header for the one caller difference).
export const tableBoardViewOptions = (
  t: (key: string) => string,
  tableLabelKey: string = 'view.table',
): ViewModeOption<'table' | 'board'>[] => [
  { id: 'table', icon: LayoutList, label: t(tableLabelKey) },
  { id: 'board', icon: Kanban, label: t('view.board') },
]
