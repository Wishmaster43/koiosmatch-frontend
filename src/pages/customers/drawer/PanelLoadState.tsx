/**
 * PanelLoadState — the one error-or-table frame of the customer drawer's sub-entity
 * panels (locations, departments, contacts): a failed GET renders the shared ErrorBanner
 * with retry and never falls through to an empty-list table (§3 four UI states); a good
 * load renders the table inside the horizontal-scroll frame the 548px panel needs.
 * Extracted once (CLONE-BY-CONSTRUCTION-1) instead of three identical blocks.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ErrorBanner from '@/components/ui/ErrorBanner'

interface PanelLoadStateProps {
  // True when the panel's own GET failed; the banner replaces the table.
  error?: boolean
  // Re-fires the failed GET.
  onRetry?: () => void
  // The panel's DataTable (or any list surface).
  children: ReactNode
}

// Error banner or the scroll-framed table, never both, never an empty table on failure.
export default function PanelLoadState({ error = false, onRetry, children }: PanelLoadStateProps) {
  const { t } = useTranslation('customers')
  if (error) return <ErrorBanner onRetry={onRetry}>{t('common:errorGeneric')}</ErrorBanner>
  // Horizontal scroll owned here: neither DataTable nor the drawer shell wraps the table,
  // and the panel clips at 548px — without this the right-hand columns would be cut off.
  return <div style={{ overflowX: 'auto' }}>{children}</div>
}
