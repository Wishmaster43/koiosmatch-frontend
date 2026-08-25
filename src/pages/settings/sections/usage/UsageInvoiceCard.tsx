/**
 * UsageInvoiceCard (F5, "Factuurvoorschot") — a provisional invoice total for
 * the selected period, fed by GET /billing/usage ONLY (workflow.amount +
 * ai.amount + whatsapp, when present). Replaces the old "Koios AI-facturatie"
 * card (GET /ai/koios/usage/billing?month=): that endpoint used a DIFFERENT
 * axis (calendar month, never the period picker) and a different price knob
 * (workflow_module_usage legacy runs vs workflow_credit_log), so mixing it in
 * here would repeat the two-truths bug the F5 brief flagged. It is
 * deliberately left out — the free AI-token allowance it used to show has no
 * equivalent on /billing/usage yet, called out honestly below rather than
 * faked (§3 no fake affordances).
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { card, sub, notice } from '../usageCardStyles'
import type { BillingUsageResponse } from '@/types/billingUsage'

interface UsageInvoiceCardProps {
  data: BillingUsageResponse['data'] | undefined
  phase: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'
}

export default function UsageInvoiceCard({ data, phase }: UsageInvoiceCardProps) {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()

  const workflowAmount = data?.workflow?.amount ?? 0
  const aiAmount = data?.ai?.amount ?? 0
  const whatsappAmount = (data?.whatsapp?.by_channel ?? []).reduce((sum, c) => sum + (c.amount ?? 0), 0)
  const total = Math.round((workflowAmount + aiAmount + whatsappAmount) * 100) / 100

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.invoice.title')}</SectionTitle>
      <div style={sub}>{t('billing.usage.invoice.subtitle')}</div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.invoice.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.invoice.unavailable')}</p>}
      {(phase === 'ready' || phase === 'empty') && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{t('billing.usage.invoice.workflowLine')}</span>
              <Mono>{formatCurrency(workflowAmount)}</Mono>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{t('billing.usage.invoice.aiLine')}</span>
              <Mono>{formatCurrency(aiAmount)}</Mono>
            </div>
            {data?.whatsapp?.by_channel && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{t('billing.usage.invoice.whatsappLine')}</span>
                <Mono>{formatCurrency(whatsappAmount)}</Mono>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <span>{t('billing.usage.invoice.totalLabel')}</span>
              <Mono>{formatCurrency(total)}</Mono>
            </div>
          </div>
          <Caption>{t('billing.usage.invoice.freeAllowanceNote')}</Caption>
        </>
      )}
    </div>
  )
}
