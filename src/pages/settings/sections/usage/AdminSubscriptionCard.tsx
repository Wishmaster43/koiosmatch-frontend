/**
 * AdminSubscriptionCard — BILLING-FACTUUR-1 slotstuk (superadmin): renders the
 * `subscription` block CMBE ships on GET /admin/tenants/{id}/usage (d6629eb4):
 * package + base price, the user split (included/active/extra + extra amount),
 * add-on modules and the month total — amounts arrive in EUROS, rendered via
 * the house formatCurrency (never cents, GEEN-KOSTEN applies to the CHAT only;
 * this is the superadmin billing surface where money is the point). When the
 * tenant sits ABOVE its included users, an honest warning line says so (Danny's
 * spec: "melding als een user buiten het pakket wordt aangemaakt").
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { SectionTitle, BodyText, Caption, Mono } from '@/components/ui/typography'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { card } from '../usageCardStyles'

export interface AdminSubscription {
  package?: string | null
  base_amount?: number | null
  users?: { included?: number; active?: number; extra?: number; extra_amount?: number } | null
  addons?: Array<{ key?: string; amount?: number }> | null
  total_amount?: number | null
}

// One row: label left, euro amount right in Mono (tabular money column).
function MoneyRow({ label, amount, strong = false }: { label: string; amount: number | null | undefined; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
      <BodyText as="span" style={strong ? { fontWeight: 600 } : undefined}>{label}</BodyText>
      <Mono style={{ fontSize: 13, fontWeight: strong ? 600 : 400 }}>{amount != null ? formatCurrency(amount) : '—'}</Mono>
    </div>
  )
}

// The superadmin subscription split; renders nothing without the block (older BE).
export default function AdminSubscriptionCard({ subscription }: { subscription?: AdminSubscription | null }) {
  const { t } = useTranslation('settings')
  if (!subscription) return null
  const users = subscription.users ?? {}
  const overLimit = (users.extra ?? 0) > 0

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('usage.subscription.title')}</SectionTitle>
      {subscription.package && (
        <Caption style={{ display: 'block', marginBottom: 8, textTransform: 'capitalize' }}>{subscription.package}</Caption>
      )}
      <MoneyRow label={t('usage.subscription.base')} amount={subscription.base_amount} />
      {/* The user split — counts as plain text, the surcharge as money. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
        <BodyText as="span">
          {t('usage.subscription.usersLine', { active: formatNumber(users.active ?? 0), included: formatNumber(users.included ?? 0) })}
        </BodyText>
        <Mono style={{ fontSize: 13 }}>{(users.extra ?? 0) > 0 ? formatCurrency(users.extra_amount ?? 0) : '—'}</Mono>
      </div>
      {overLimit && (
        // Honest over-limit signal: icon + text, warning INK twin (never the raw fill).
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 8px' }}>
          <AlertTriangle size={13} color="var(--color-warning-text)" aria-hidden="true" />
          <Caption style={{ color: 'var(--color-warning-text)' }}>
            {t('usage.subscription.overLimit', { extra: formatNumber(users.extra ?? 0) })}
          </Caption>
        </div>
      )}
      {(subscription.addons ?? []).map((a, i) => (
        <MoneyRow key={a.key ?? i} label={t(`usage.subscription.addon.${a.key}`, { defaultValue: a.key ?? '—' })} amount={a.amount} />
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <MoneyRow label={t('usage.subscription.total')} amount={subscription.total_amount} strong />
      </div>
    </div>
  )
}
