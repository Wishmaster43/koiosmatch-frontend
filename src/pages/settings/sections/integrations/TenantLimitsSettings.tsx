/**
 * TenantLimitsSettings — Settings → Integrations → Usage & limits (LIMIET-MONITOR-1,
 * Danny 07-09: "hoeveel calls we hebben gedaan en tegen welke limieten we aanlopen").
 * One LimitMeterRow per row of GET /settings/integrations/limits; the ai/workflow
 * rows also show their billing tier when the caller holds billing.view (the
 * backend only sends `prices` then). Polls no faster than once a minute.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import LimitMeterRow from '@/components/ui/LimitMeterRow'
import { SettingsScaffold, SettingCardList, SettingCard } from '@/pages/settings/components/SettingsKit'
import { Caption } from '@/components/ui/typography'
import { getTenantLimits, type TenantLimitRow } from './limitsApi'
import type { BillingTierRef } from '@/types/billingTiers'

// The tier a meter row is priced on: the tenant's chosen tier, else the package baseline (measured on demo: `tier` null, `baseline_tier` set).
const tierOf = (row: TenantLimitRow): BillingTierRef | null => row.prices?.tier?.tier ?? row.prices?.tier?.baseline_tier ?? null

export default function TenantLimitsSettings() {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()

  // The tenant's own meters; a minute of staleness is the agreed polling floor.
  const { data, isPending, isError } = useQuery({ queryKey: ['tenant-limits'], queryFn: getTenantLimits, staleTime: 60_000 })
  const rows = data ?? []

  return (
    <SettingsScaffold title={t('limits.usage_and_limits')} subtitle={t('limits.subtitle')}
      maxWidth={720} form={{ loading: isPending, loadError: isError }} actions={undefined}>
      {rows.length === 0 ? (
        <Caption as="div">{t('limits.empty')}</Caption>
      ) : (
        <SettingCardList>
          {rows.map(row => (
            <SettingCard key={row.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <LimitMeterRow meter={row} />
              {/* Billing tier (billing.view only): the chosen tier, else the package baseline. */}
              {tierOf(row) && (
                <Caption as="div">
                  {t('limits.tier.included', { tier: tierOf(row)?.label ?? tierOf(row)?.key, n: formatNumber(tierOf(row)?.monthly_tokens ?? tierOf(row)?.monthly_runs ?? row.cap ?? 0) })}
                  {' · '}
                  {t('limits.tier.price', { amount: formatCurrency((tierOf(row)?.price_cents ?? 0) / 100) })}
                </Caption>
              )}
            </SettingCard>
          ))}
        </SettingCardList>
      )}
    </SettingsScaffold>
  )
}
