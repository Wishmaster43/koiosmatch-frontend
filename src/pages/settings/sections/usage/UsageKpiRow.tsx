import { Wallet, Workflow, Sparkles, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import KpiCard from '@/components/ui/KpiCard'
import type { BillingUsageResponse } from '@/types/billingUsage'

interface WhatsAppUsage { cost?: { total?: number }; usage?: { waba_messages?: number }; currency?: string }

interface UsageKpiRowProps {
  billing: BillingUsageResponse['data'] | undefined
  billingLoading: boolean
  wa: WhatsAppUsage | null
  waLoading: boolean
}

/**
 * UsageKpiRow (BILLING-USAGE-REDESIGN-1) — equal-footprint KPI strip on top of the
 * usage page, reusing the shared KpiCard atom (§3A blueprint — never a hand-rolled
 * tile). Four cards: Total this period (workflow + AI amount for the selected
 * `/billing/usage` period — the endpoint has no single "total" field, so this is
 * the documented sum, not a fabricated figure), Workflow (credits + EUR), Koios AI
 * (tokens + EUR), WhatsApp (EUR + messages — deliberately month-only, the messaging
 * endpoint has no period param at all, see UsageOverviewSection's header comment).
 */
export default function UsageKpiRow({ billing, billingLoading, wa, waLoading }: UsageKpiRowProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()

  // Total this period = workflow.amount + ai.amount — the endpoint returns no
  // single "total" field for this period shape (only the K0 monthly billing
  // endpoint has `total_amount`, on a different `month` axis) — see the file
  // header comment. Rounded the same way mergeDailyRows rounds daily totals.
  const totalAmount = billing ? Math.round(((billing.workflow?.amount ?? 0) + (billing.ai?.amount ?? 0)) * 100) / 100 : undefined
  const aiTokens = (billing?.ai?.input_tokens ?? 0) + (billing?.ai?.output_tokens ?? 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
      <KpiCard
        loading={billingLoading}
        icon={Wallet} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('billing.usage.kpi.totalLabel')}
        value={billing ? formatCurrency(totalAmount) : '—'}
      />
      <KpiCard
        loading={billingLoading}
        icon={Workflow} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('billing.usage.kpi.workflowLabel')}
        value={billing ? formatCurrency(billing.workflow?.amount) : '—'}
        // credit_price is UNROUNDED by contract (types/billingUsage.ts): render up
        // to 4 decimals, never round it away — restored from the old Credits card.
        note={billing ? t('billing.usage.kpi.workflowNote', {
          n: formatNumber(billing.workflow?.total_credits ?? 0),
          price: formatCurrency(billing.workflow?.credit_price, 'EUR', 4, 2),
        }) : undefined}
      />
      <KpiCard
        loading={billingLoading}
        icon={Sparkles} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('billing.usage.kpi.koiosLabel')}
        value={billing ? formatCurrency(billing.ai?.amount) : '—'}
        note={billing ? t('billing.usage.kpi.koiosNote', { n: formatNumber(aiTokens) }) : undefined}
      />
      <KpiCard
        loading={waLoading}
        icon={MessageCircle} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('billing.usage.kpi.whatsappLabel')}
        value={wa ? formatCurrency(wa.cost?.total, wa.currency ?? 'EUR') : '—'}
        note={wa ? t('billing.usage.kpi.whatsappNote', { n: formatNumber(wa.usage?.waba_messages ?? 0) }) : undefined}
      />
    </div>
  )
}
