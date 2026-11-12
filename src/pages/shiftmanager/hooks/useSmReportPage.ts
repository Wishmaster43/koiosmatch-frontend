/**
 * useSmReportPage — the shared head of the three Shiftmanager tree reports (customers,
 * locations, departments): translations, number format, the customer tree with its
 * loading/error/truncated/reload states, the drill-drawer state and the right panel.
 * Extracted so the three pages do not repeat the same seven lines (CLONE-BY-CONSTRUCTION-1).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { useNumberFormat } from '@/lib/formatters'
import { useSmCustomerTree } from '@/hooks/useSmCustomerTree'
import type { SmDrillItem } from '@/types/shiftmanager'

// The KPI drill drawer: a title plus the rows it lists, or closed.
export type SmDrillDrawer = { title: string; items: SmDrillItem[] } | null

// One hook call per report page; every value is the same object the page used to build itself.
export function useSmReportPage() {
  const { t } = useTranslation('shiftmanager')
  const { formatNumber } = useNumberFormat()
  const tree = useSmCustomerTree()
  const [drawer, setDrawer] = useState<SmDrillDrawer>(null)
  const { registerFilters, unregisterFilters } = useRightPanel()
  return { t, formatNumber, ...tree, drawer, setDrawer, registerFilters, unregisterFilters }
}
