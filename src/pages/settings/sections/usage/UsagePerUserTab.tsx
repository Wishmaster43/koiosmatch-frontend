/**
 * UsagePerUserTab (F5, "Per gebruiker") — ai.per_user from GET /billing/usage,
 * one row per user with AI-token calls, tokens, amount and success rate.
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { SectionTitle } from '@/components/ui/typography'
import { card, sub, notice } from '../usageCardStyles'
import type { BillingUsageAi, BillingUsageAiPerUser } from '@/types/billingUsage'

interface UsagePerUserTabProps {
  ai: BillingUsageAi | undefined
  phase: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'
}

export default function UsagePerUserTab({ ai, phase }: UsagePerUserTabProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency, formatRatio } = useNumberFormat()

  const columns: Column<BillingUsageAiPerUser>[] = [
    { key: 'name', header: t('billing.usage.perUser.colName'), sortable: true, render: (r) => r.name ?? r.user_id },
    { key: 'calls', header: t('billing.usage.perUser.colCalls'), align: 'right', sortable: true, render: (r) => formatNumber(r.calls) },
    { key: 'tokens', header: t('billing.usage.perUser.colTokens'), align: 'right', sortable: true, sortValue: (r) => (r.input_tokens ?? 0) + (r.output_tokens ?? 0), render: (r) => formatNumber((r.input_tokens ?? 0) + (r.output_tokens ?? 0)) },
    { key: 'amount', header: t('billing.usage.perUser.colAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: 'success_rate', header: t('billing.usage.perUser.colSuccessRate'), align: 'right', sortable: true, render: (r) => r.success_rate === undefined ? '—' : formatRatio(r.success_rate) },
  ]

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.perUser.title')}</SectionTitle>
      <div style={sub}>{t('billing.usage.perUser.subtitle')}</div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.perUser.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.perUser.unavailable')}</p>}
      {(phase === 'ready' || phase === 'empty') && (
        <DataTable columns={columns} rows={ai?.per_user ?? []} getRowId={(r) => r.user_id}
          emptyText={t('billing.usage.perUser.empty')} />
      )}
    </div>
  )
}
