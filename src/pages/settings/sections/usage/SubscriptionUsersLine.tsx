/**
 * SubscriptionUsersLine (K-167, unchanged shape now typed under PRIJSMODEL-C) —
 * the one-line "N users (M included)" caption plus an honest extra-users line
 * when the tenant runs above its included seat count.
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { Caption } from '@/components/ui/typography'
import { notice } from '../usageCardStyles'
import type { BillingUsageUsers } from '@/types/billingUsage'

interface SubscriptionUsersLineProps {
  users?: BillingUsageUsers | null
}

// Presence-gated seat-count line — absent when the backend sends no users block.
export default function SubscriptionUsersLine({ users }: SubscriptionUsersLineProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()

  if (!users || (users.active === undefined && users.included === undefined)) return null

  return (
    <div style={{ marginTop: 4 }}>
      <Caption>
        {t('billing.usage.plan.users.line', { active: formatNumber(users.active ?? 0), included: formatNumber(users.included ?? 0) })}
      </Caption>
      {(users.extra ?? 0) > 0 && (
        <p style={notice}>
          {t('billing.usage.plan.users.extra', {
            extra: formatNumber(users.extra ?? 0),
            amount: formatCurrency(users.extra_amount ?? 0),
          })}
        </p>
      )}
    </div>
  )
}
