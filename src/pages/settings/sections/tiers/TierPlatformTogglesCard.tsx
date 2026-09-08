/**
 * TierPlatformTogglesCard (PRIJSMODEL-C, DEEL C §4c) — the platform-wide overage
 * toggles per meter plus the shared warn-percentage knob, as settings-kit rows
 * (label left, control right — the one settings face). Props-only presenter; the
 * parent container owns GET/PUT, headings and the SaveButton.
 */
import { useTranslation } from 'react-i18next'
import Toggle from '@/components/ui/Toggle'
import CurrencyInput from '@/components/ui/CurrencyInput'
import type { BillingOverageConfig } from '@/types/billingTiers'
import { NumberField, SettingCardList, SettingRow } from '@/pages/settings/components/SettingsKit'

// Patch shape this card sends up — one call per field change, always partial,
// and always exactly the changed field (never the whole overage object) so the
// container's dirty-merge never rewrites sibling fields (F1).
type TogglesPatch = Partial<{ overage: Partial<BillingOverageConfig>; warn_at_pct: number }>

interface TierPlatformTogglesCardProps {
  overage: BillingOverageConfig
  warnAtPct?: number
  onChange: (patch: TogglesPatch) => void
  disabled?: boolean
}

// One meter's overage: a switch row and a euro price row that follows the switch.
function OverageMeterRows({
  meterName, priceLabel, enabled, priceCents, onToggle, onPriceChange, disabled,
}: {
  meterName: string; priceLabel: string; enabled: boolean; priceCents: number
  onToggle: (v: boolean) => void; onPriceChange: (cents: number) => void; disabled?: boolean
}) {
  const { t } = useTranslation('settings')
  return (
    <>
      <SettingRow label={`${meterName}: ${t('billingTiers.overageEnabled')}`}
        description={enabled ? undefined : t('billingTiers.overageOffCaption')}>
        {/* The switch name carries the meter, so the two switches never share one accessible name (§6). */}
        <Toggle checked={enabled} ariaLabel={`${t('billingTiers.overageEnabled')}: ${meterName}`} disabled={disabled} onChange={onToggle} />
      </SettingRow>
      <SettingRow label={`${meterName}: ${priceLabel}`}>
        <CurrencyInput cents={priceCents} disabled={!enabled || disabled} width={110}
          ariaLabel={`${priceLabel}: ${meterName}`}
          onChange={(cents) => onPriceChange(cents ?? 0)} />
      </SettingRow>
    </>
  )
}

// Renders the two overage meters plus warn_at_pct as kit rows.
export default function TierPlatformTogglesCard({ overage, warnAtPct, onChange, disabled }: TierPlatformTogglesCardProps) {
  const { t } = useTranslation('settings')

  return (
    <SettingCardList>
      <OverageMeterRows
        meterName={t('billing.usage.plan.tier.aiTitle')}
        priceLabel={t('billingTiers.overageAiPrice')}
        enabled={overage.ai_enabled ?? false}
        priceCents={overage.ai_price_cents ?? 0}
        disabled={disabled}
        onToggle={(v) => onChange({ overage: { ai_enabled: v } })}
        onPriceChange={(cents) => onChange({ overage: { ai_price_cents: cents } })}
      />
      <OverageMeterRows
        meterName={t('billing.usage.plan.tier.workflowTitle')}
        priceLabel={t('billingTiers.overageWorkflowPrice')}
        enabled={overage.workflow_enabled ?? false}
        priceCents={overage.workflow_price_cents ?? 0}
        disabled={disabled}
        onToggle={(v) => onChange({ overage: { workflow_enabled: v } })}
        onPriceChange={(cents) => onChange({ overage: { workflow_price_cents: cents } })}
      />
      <SettingRow label={t('billingTiers.warnPctLabel')}>
        <NumberField value={warnAtPct ?? 0} min={0} max={100} unit="%" width={80} disabled={disabled}
          ariaLabel={t('billingTiers.warnPctLabel')}
          onChange={(v: number) => onChange({ warn_at_pct: v })} />
      </SettingRow>
    </SettingCardList>
  )
}
