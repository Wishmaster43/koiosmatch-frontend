/**
 * UsageInvoiceCard (F5, "Factuurvoorschot") — a provisional invoice total for
 * the selected period, fed by GET /billing/usage ONLY (workflow.amount +
 * ai.amount; K-242 folded WhatsApp into the workflow line). Replaces the old "Koios AI-facturatie"
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
// K-242 (02-09): WhatsApp Tokens fold into the workflow amount — `whatsapp.by_channel`
// is INFO only now (message counts), so it no longer contributes its own invoice line.

interface UsageInvoiceCardProps {
  data: BillingUsageResponse['data'] | undefined
  phase: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'
}

// Provisional invoice total from the one /billing/usage source only; deliberately never mixes in the legacy Koios-usage endpoint's different axis/price knob (see file header).
export default function UsageInvoiceCard({ data, phase }: UsageInvoiceCardProps) {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()

  const workflowAmount = data?.workflow?.amount ?? 0
  const aiAmount = data?.ai?.amount ?? 0
  const total = Math.round((workflowAmount + aiAmount) * 100) / 100

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
