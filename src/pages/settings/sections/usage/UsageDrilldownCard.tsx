/**
 * UsageDrilldownCard (BILLING-USAGE-REDESIGN-1) — the single-day detail card that
 * opens under the chart when a day-bar or a table row is clicked. Renders ONLY
 * figures that really exist on a merged DailyRow (workflow credits/EUR, AI
 * tokens-in/out/EUR, total) — no fabricated per-activity split for a single day
 * (§3 no fake affordances; the backend has no per-day×activity breakdown).
 * Keyboard-reachable close button; Escape also closes (handled by the parent via
 * the button's own focus — no global key listener needed for one dismiss control).
 */
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import Button from '@/components/ui/Button'
import StatTile from '@/components/ui/StatTile'
import { SectionTitle } from '@/components/ui/typography'
import type { DailyRow } from './dailyUsageTypes'
import { card } from '../usageCardStyles'

interface UsageDrilldownCardProps {
  row: DailyRow
  onClose: () => void
}

// Single-day detail card (see the module doc above): renders only the figures that really exist on a merged row, never a fabricated per-activity split.
export default function UsageDrilldownCard({ row, onClose }: UsageDrilldownCardProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const { formatDate } = useDateFormat()

  return (
    <div style={{ ...card, borderColor: 'var(--color-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <SectionTitle style={{ marginBottom: 0 }}>{t('billing.usage.daily.drilldownTitle', { date: formatDate(row.date) })}</SectionTitle>
        <Button variant="ghost" size="sm" iconOnly aria-label={t('billing.usage.daily.drilldownClose')} onClick={onClose}>
          <X size={14} />
        </Button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <StatTile size="sm" labelFirst label={t('billing.usage.daily.colWorkflowCredits')} value={formatNumber(row.workflowCredits)} />
        <StatTile size="sm" labelFirst label={t('billing.usage.daily.colWorkflowAmount')} value={formatCurrency(row.workflowAmount)} />
        <StatTile size="sm" labelFirst label={t('billing.usage.daily.colAiTokens')} value={formatNumber(row.aiInputTokens + row.aiOutputTokens)} />
        <StatTile size="sm" labelFirst label={t('billing.usage.daily.colAiAmount')} value={formatCurrency(row.aiAmount)} />
        <StatTile size="sm" labelFirst label={t('billing.usage.daily.colTotalAmount')} value={formatCurrency(row.totalAmount)} />
      </div>
    </div>
  )
}
