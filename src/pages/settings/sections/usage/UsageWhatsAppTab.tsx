/**
 * UsageWhatsAppTab (F5, "WhatsApp") — renders the per-channel message count table
 * from GET /billing/usage's whatsapp.by_channel block (K-242: INFO only, no
 * tokens/amount/meter — a wa_web message counts as a Workflow-token in the
 * `workflow` block instead).
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { SectionTitle } from '@/components/ui/typography'
import { card, sub, notice } from '../usageCardStyles'
import type { BillingUsageWhatsapp, BillingUsageWhatsappChannel } from '@/types/billingUsage'

interface UsageWhatsAppTabProps {
  whatsapp: BillingUsageWhatsapp | undefined
}

// Usage settings' WhatsApp tab: per-channel message count breakdown from the billing-usage payload.
export default function UsageWhatsAppTab({ whatsapp }: UsageWhatsAppTabProps) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('candidates')
  const { formatNumber } = useNumberFormat()

  // The backend always sends all three Channel rows (zeros when a channel is
  // unused), so gate on real activity (messages > 0), not just array presence.
  const hasChannelData = (whatsapp?.by_channel ?? []).some((c) => (c.messages ?? 0) > 0)

  const channelColumns: Column<BillingUsageWhatsappChannel>[] = [
    { key: 'channel', header: t('billing.usage.whatsapp.colChannel'), render: (r) => tc(`conversations.channel.${r.channel}`, { defaultValue: r.label ?? r.channel }) },
    { key: 'messages', header: t('billing.usage.whatsapp.colMessages'), align: 'right', render: (r) => formatNumber(r.messages) },
  ]

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.whatsapp.title')}</SectionTitle>
      <div style={sub}>{t('billing.usage.whatsapp.subtitle')}</div>

      {hasChannelData && whatsapp?.by_channel ? (
        <DataTable columns={channelColumns} rows={whatsapp.by_channel} getRowId={(r) => r.channel}
          emptyText={t('billing.usage.whatsapp.empty')} />
      ) : (
        <p style={notice}>{t('billing.usage.whatsapp.empty')}</p>
      )}
    </div>
  )
}
