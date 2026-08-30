/**
 * TierPlatformTogglesCard (PRIJSMODEL-C, DEEL C §4c) — the platform-wide overage
 * toggles per meter plus the shared warn-percentage and upgrade-contact knobs.
 * Props-only presenter (mirrors PlatformPricingCard's percent-suffix input);
 * the parent container owns GET/PUT, headings and the SaveButton (F3: this
 * card renders no SectionTitle of its own — the container already prints one).
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import Toggle from '@/components/ui/Toggle'
import { BodyText, Caption, GroupLabel } from '@/components/ui/typography'
import type { BillingOverageConfig } from '@/types/billingTiers'
import { inputWrap, inputStyle, label as labelStyle } from '../billingCardStyles'

// Patch shape this card sends up — one call per field change, always partial,
// and always exactly the changed field (never the whole overage object) so the
// container's dirty-merge never rewrites sibling fields (F1).
type TogglesPatch = Partial<{ overage: Partial<BillingOverageConfig>; warn_at_pct: number; upgrade_contact: string | null }>

interface TierPlatformTogglesCardProps {
  overage: BillingOverageConfig
  warnAtPct?: number
  upgradeContact?: string | null
  onChange: (patch: TogglesPatch) => void
  disabled?: boolean
}

// One meter's overage row: a GroupLabel naming the meter, then toggle + a cents
// price input that disables with the platform when off.
function OverageMeterRow({
  meterName, priceLabel, enabled, priceCents, onToggle, onPriceChange, disabled,
}: {
  meterName: string; priceLabel: string; enabled: boolean; priceCents: number
  onToggle: (v: boolean) => void; onPriceChange: (cents: number) => void; disabled?: boolean
}) {
  const { t } = useTranslation('settings')
  const priceId = useId()
  return (
    <div style={{ marginBottom: 12 }}>
      <GroupLabel style={{ marginBottom: 6 }}>{meterName}</GroupLabel>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* The switch name carries the meter, so the two switches never share one accessible name (§6). */}
          <Toggle checked={enabled} ariaLabel={`${t('billingTiers.overageEnabled')}: ${meterName}`} disabled={disabled} onChange={onToggle} />
          <BodyText>{t('billingTiers.overageEnabled')}</BodyText>
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <label htmlFor={priceId} style={labelStyle}>{priceLabel}</label>
          <div style={inputWrap}>
            <input
              id={priceId}
              type="number" min={0} step={1}
              value={priceCents}
              disabled={!enabled || disabled}
              onChange={(e) => onPriceChange(Number(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          {!enabled && <Caption>{t('billingTiers.overageOffCaption')}</Caption>}
        </div>
      </div>
    </div>
  )
}

// Renders the two overage meter rows plus warn_at_pct and upgrade_contact.
export default function TierPlatformTogglesCard({ overage, warnAtPct, upgradeContact, onChange, disabled }: TierPlatformTogglesCardProps) {
  const { t } = useTranslation('settings')
  const warnId = useId()
  const contactId = useId()

  return (
    <div>
      <OverageMeterRow
        meterName={t('billing.usage.plan.tier.aiTitle')}
        priceLabel={t('billingTiers.overageAiPrice')}
        enabled={overage.ai_enabled ?? false}
        priceCents={overage.ai_price_cents ?? 0}
        disabled={disabled}
        onToggle={(v) => onChange({ overage: { ai_enabled: v } })}
        onPriceChange={(cents) => onChange({ overage: { ai_price_cents: cents } })}
      />
      <OverageMeterRow
        meterName={t('billing.usage.plan.tier.workflowTitle')}
        priceLabel={t('billingTiers.overageWorkflowPrice')}
        enabled={overage.workflow_enabled ?? false}
        priceCents={overage.workflow_price_cents ?? 0}
        disabled={disabled}
        onToggle={(v) => onChange({ overage: { workflow_enabled: v } })}
        onPriceChange={(cents) => onChange({ overage: { workflow_price_cents: cents } })}
      />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <label htmlFor={warnId} style={labelStyle}>{t('billingTiers.warnPctLabel')}</label>
          <div style={inputWrap}>
            <input
              id={warnId}
              type="number" min={0} max={100} step={1}
              value={warnAtPct ?? 0}
              disabled={disabled}
              onChange={(e) => onChange({ warn_at_pct: Number(e.target.value) || 0 })}
              style={inputStyle}
            />
            <Caption>%</Caption>
          </div>
        </div>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <label htmlFor={contactId} style={labelStyle}>{t('billingTiers.upgradeContactLabel')}</label>
          <div style={inputWrap}>
            <input
              id={contactId}
              type="text"
              value={upgradeContact ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ upgrade_contact: e.target.value === '' ? null : e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
