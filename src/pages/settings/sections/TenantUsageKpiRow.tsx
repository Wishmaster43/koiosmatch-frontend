/**
 * TenantUsageKpiRow (TENANT-USAGE-POLISH-1) — the superadmin equivalent of the
 * tenant-facing usage/UsageKpiRow, mirroring its equal-footprint KpiCard strip
 * (§3A blueprint) but with the MARGEGEHEIM fields the tenant screen never shows:
 * AI purchase/sale/margin + tokens (billing.ai, additive per CONTRACT-CHANGELOG
 * 13-08 "CREDITS-1 fase 1" §4), Workflow runs + EUR (workflow_tokens.total_module_runs
 * + billing.workflow.amount), WhatsApp Business numbers, processed planning hours.
 * All from the ALREADY-FETCHED GET /admin/tenants/{id}/usage response for the
 * selected month — no new request, no re-derivation.
 */
import { Sparkles, Workflow, MessageCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import KpiCard from '@/components/ui/KpiCard'
import { Caption, SectionTitle } from '@/components/ui/typography'
import { MeterBar } from './usage/SubscriptionCard'
import type { AdminTenantUsage } from '@/types/billingUsage'

interface Props {
  usage: AdminTenantUsage | null
  loading: boolean
}

// The superadmin usage KPI strip (AI margin, workflow tokens, WhatsApp numbers,
// planning hours) — all read off the already-fetched monthly usage response.
export default function TenantUsageKpiRow({ usage, loading }: Props) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const { formatDate } = useDateFormat()

  const aiPurchase = usage?.billing?.ai?.purchase
  const aiSale = usage?.billing?.ai?.sale
  const aiMargin = usage?.billing?.ai?.margin
  const aiTokens = usage?.ai?.tokens
  const workflowAmount = usage?.billing?.workflow?.amount
  // CREDITS-2-FE deel 3 — the package-budget split alongside the raw credits.
  const workflowCredits = usage?.billing?.workflow?.credits
  const workflowIncluded = usage?.billing?.workflow?.included_budget
  const workflowBillable = usage?.billing?.workflow?.billable_credits

  return (
    <div>
      {usage?.billing?.resets_at && (
        <Caption style={{ marginBottom: 6 }}>{t('billing.usage.plan.resetsOn', { date: formatDate(usage.billing.resets_at) })}</Caption>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 18 }}>
      <KpiCard
        loading={loading}
        icon={Sparkles} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('usage.kpi.aiLabel')}
        value={aiSale != null ? formatCurrency(aiSale) : '—'}
        note={t('usage.kpi.aiNote', {
          purchase: aiPurchase != null ? formatCurrency(aiPurchase) : '—',
          margin: aiMargin != null ? formatCurrency(aiMargin) : '—',
          tokens: formatNumber(aiTokens ?? 0),
        })}
      />
      <KpiCard
        loading={loading}
        icon={Workflow} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('usage.kpi.workflowLabel')}
        value={workflowAmount != null ? formatCurrency(workflowAmount) : '—'}
        note={workflowBillable != null ? t('usage.kpi.workflowBillableNote', {
          billable: formatNumber(workflowBillable),
          credits: formatNumber(workflowCredits ?? 0),
          included: formatNumber(workflowIncluded ?? 0),
        }) : undefined}
      />
      <KpiCard
        loading={loading}
        icon={MessageCircle} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('usage.kpi.whatsappLabel')}
        value={formatNumber(usage?.whatsapp?.business_numbers ?? 0)}
      />
      <KpiCard
        loading={loading}
        icon={Clock} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary)"
        label={t('usage.kpi.planningLabel')}
        value={formatNumber(usage?.planning?.processed_hours ?? 0)}
      />
      </div>

      {/* Workflow (Koios Tokens) budget-status strip — the ONLY meter this
          superadmin endpoint carries a real used/budget/over split for.
          Measured (CLAUDE.md §10 discipline): AdminUsageController::show never
          merges an ai_token_budget or a whatsapp tokens/by_channel block, so
          the AI and WhatsApp meters cannot render honestly here yet — see the
          worklist handoff rather than fake a bar with a guessed budget. */}
      {(workflowIncluded ?? 0) > 0 ? (
        <div style={{ maxWidth: 320, marginBottom: 18 }}>
          <SectionTitle style={{ marginBottom: 6, fontSize: 12 }}>{t('usage.kpi.budgetStatus.title')}</SectionTitle>
          <MeterBar label={t('usage.kpi.workflowLabel')} used={workflowCredits} budget={workflowIncluded} />
          {(workflowBillable ?? 0) > 0 ? (
            <Caption style={{ color: 'var(--color-danger-text)' }}>
              {t('billing.usage.plan.overBudget', {
                meter: t('usage.kpi.workflowLabel'),
                n: formatNumber(workflowBillable ?? 0),
                amount: formatCurrency(workflowAmount ?? 0),
              })}
            </Caption>
          ) : (
            <Caption>{t('usage.kpi.budgetStatus.withinBudget')}</Caption>
          )}
        </div>
      ) : (
        // Legacy packages emit included_budget 0 - that is "no budget configured",
        // never a 0-budget meter with a danger line (the false-over the audit caught).
        <Caption as="div" style={{ marginBottom: 18 }}>{t('usage.kpi.budgetStatus.noBudget')}</Caption>
      )}
    </div>
  )
}
