/**
 * TierMeter (PRIJSMODEL-C, TASK D) — the one meter atom for a tenant's AI or
 * workflow tier consumption. Mirrors SubscriptionCard's MeterBar (§4 tint bar)
 * with a ghost icon Button as the drill, and reads the richer BillingUsageTierMeter shape: tier name,
 * server-computed pct/state, warn/blocked callouts (CalloutBox), the overage
 * line and the AI-only weights caption. Never renders a lone "0" — every
 * number carries its unit/label. Consumed by SubscriptionCard (TASK G).
 * The period reset date is printed ONCE by SubscriptionCard's header, so this
 * atom deliberately carries no resetsAt prop (deviation from the DEEL C brief).
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useNumberFormat } from '@/lib/formatters'
import { tintBg } from '@/lib/tint'
import { Caption, Mono } from '@/components/ui/typography'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import type { BillingUsageTierMeter, BillingMeterState } from '@/types/billingUsage'

interface TierMeterProps {
  label: string
  meter?: BillingUsageTierMeter | null
  // Which unit vocabulary to pluralise (billing.usage.plan.tier.unitToken/unitRun).
  unit: 'token' | 'run'
  // For the mailto upgrade subject (tier.upgradeSubject {{tenant}}).
  tenantName?: string
  onDrill?: () => void
}

// One tier vocabulary lookup, correctly pluralised on the given count.
function unitLabel(t: (k: string, o?: Record<string, unknown>) => string, unit: 'token' | 'run', count: number): string {
  return unit === 'token' ? t('billing.usage.plan.tier.unitToken', { count }) : t('billing.usage.plan.tier.unitRun', { count })
}

// A mailto contact gets the tenant-named upgrade subject appended; a plain
// URL contact is used as-is (never a fake affordance either way, §3A).
function upgradeHref(contact: string, t: (k: string, o?: Record<string, unknown>) => string, tenantName?: string): string {
  if (!contact.startsWith('mailto:')) return contact
  const subject = t('billing.usage.plan.tier.upgradeSubject', { tenant: tenantName ?? '' })
  const [base, existingQuery] = contact.split('?')
  const params = new URLSearchParams(existingQuery)
  params.set('subject', subject)
  return `${base}?${params.toString()}`
}

// The one tenant tier-meter atom — AI or workflow, driven entirely by server fields.
export default function TierMeter({ label, meter, unit, tenantName, onDrill }: TierMeterProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()

  const used = meter?.used ?? 0
  const allowance = meter?.allowance ?? meter?.budget ?? 0
  // Server-computed percentage wins; only computed locally when absent.
  const pct = meter?.pct ?? (allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0)
  const warnAt = meter?.warn_at_pct ?? 80
  const state: BillingMeterState = meter?.state ?? (pct >= 100 ? 'blocked' : pct >= warnAt ? 'warn' : 'ok')
  const hasTier = Boolean(meter?.tier)
  const tierName = meter?.tier?.label ?? meter?.tier?.key ?? t('billing.usage.plan.tier.none')
  const over = meter?.over ?? 0
  // An overage price is only a fact when the server sent one (SCHERMWAARHEID-1:
  // never render "€ 0,00 per token" because a field was absent).
  const overagePriceCents = meter?.overage_enabled && meter.overage_price_cents != null ? meter.overage_price_cents : null
  const trackBg = tintBg('var(--color-primary)')
  const fill = state === 'blocked' ? 'var(--color-danger)' : state === 'warn' ? 'var(--color-warning)' : 'var(--button-fill)'

  // The AI-only weighting caption (chat=1, other activities relative to it,
  // plus the slim/max flavour multipliers) — only when the server sent weights.
  const weights = meter && 'weights' in meter ? meter.weights : undefined
  // The contract carries a per-activity map (chat + any non-chat activity,
  // e.g. note_assist) — never a literal "other" key — so chat and other are
  // each derived from the map with the documented defaults (chat 3, rest 1).
  const activityEntries = weights?.activities ? Object.entries(weights.activities) : []
  const chatWeight = weights?.activities?.chat ?? 3
  const otherWeight = activityEntries.find(([key]) => key !== 'chat')?.[1] ?? 1
  const weightsLine = activityEntries.length > 0
    ? t('billing.usage.plan.tier.weightsLine', {
        chat: formatNumber(chatWeight),
        other: formatNumber(otherWeight),
        slim: formatNumber(weights?.flavors?.slim ?? 2),
        max: formatNumber(weights?.flavors?.max ?? 5),
      })
    : null

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, gap: 10 }}>
        <div>
          <Caption>{label}</Caption>
          <Caption style={{ display: 'block', color: 'var(--text-muted)' }}>
            {meter?.tier ? t('billing.usage.plan.tier.name', { name: tierName }) : t('billing.usage.plan.tier.none')}
          </Caption>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Sized explicitly: Mono inherits 16px otherwise and would outgrow the 13px card title (Danny 24-08). */}
          <Mono style={{ fontSize: 12, color: 'var(--text)' }}>
            {t('billing.usage.plan.tier.consumed', { used: formatNumber(used), included: formatNumber(allowance) })}
          </Mono>
          {/* The drill is a real ghost Button (HUISSTIJL-1), not a click-anywhere bar: the row stays honest and keyboard-reachable. */}
          {onDrill && (
            <Button variant="ghost" size="sm" iconOnly aria-label={`${t('billing.usage.plan.meterDrill')}: ${label}`} onClick={onDrill}>
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: trackBg }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 999, background: fill, transition: 'width var(--motion-fast, 150ms) ease' }} />
      </div>
    </>
  )

  return (
    <div style={{ marginBottom: 14 }}>
      {body}

      {state === 'warn' && (
        <CalloutBox variant="warning">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} color="var(--color-on-warning-bg)" aria-hidden="true" />
            <span>
              {hasTier
                ? t('billing.usage.plan.tier.warning', { pct: formatNumber(pct), tier: tierName })
                : t('billing.usage.plan.tier.warningNoTier', { pct: formatNumber(pct) })}
            </span>
          </div>
        </CalloutBox>
      )}

      {state === 'blocked' && (
        <CalloutBox variant="danger">
          {overagePriceCents != null ? (
            <span>
              {t(hasTier ? 'billing.usage.plan.tier.exceededOverage' : 'billing.usage.plan.tier.exceededOverageNoTier', {
                tier: tierName,
                price: formatCurrency(overagePriceCents / 100, 'EUR', 2, 2),
                unit: unitLabel(t, unit, 1),
              })}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>{t(hasTier ? 'billing.usage.plan.tier.exceeded' : 'billing.usage.plan.tier.exceededNoTier', { tier: tierName })}</span>
              {meter?.upgrade_hint?.contact && (
                <Button variant="primary" size="sm" href={upgradeHref(meter.upgrade_hint.contact, t, tenantName)}>
                  {t('billing.usage.plan.tier.upgradeCta')}
                </Button>
              )}
            </div>
          )}
        </CalloutBox>
      )}

      {over > 0 && overagePriceCents != null && (
        <Caption style={{ display: 'block', marginTop: 4 }}>
          {t('billing.usage.plan.tier.overageLine', {
            n: formatNumber(over),
            unit: unitLabel(t, unit, over),
            amount: formatCurrency((overagePriceCents * over) / 100, 'EUR', 2, 2),
          })}
        </Caption>
      )}

      {weightsLine && <Caption style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>{weightsLine}</Caption>}
    </div>
  )
}
