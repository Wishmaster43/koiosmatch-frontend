/**
 * TierPackageIncludesCard (PRIJSMODEL-C DEEL C, task E2) — what each of the
 * three packages includes by default: a monthly workflow-token allowance and an
 * optional AI baseline tier, as settings-kit rows (label left, controls right).
 * Props-only presenter; the parent container owns GET/PUT and the SaveButton.
 */
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { PACKAGE_KEYS } from '../billingCardStyles'
import { NumberField, SettingCardList, SettingRow } from '@/pages/settings/components/SettingsKit'
import type { BillingAiTier, BillingPackageBaseline, BillingPackageKey } from '@/types/billingTiers'

interface Props {
  baselines: Partial<Record<BillingPackageKey, BillingPackageBaseline>>
  aiTiers: BillingAiTier[]
  onChange: (pkg: BillingPackageKey, patch: Partial<BillingPackageBaseline>) => void
  disabled?: boolean
}

// One row per package: the runs allowance and a single-pick AI tier side by side.
export default function TierPackageIncludesCard({ baselines, aiTiers, onChange, disabled }: Props) {
  const { t } = useTranslation('settings')

  // Only active tiers are pickable — an inactive tier is not a valid baseline choice.
  const aiOptions = [
    { value: '', label: t('billingTiers.includesAiNone') },
    ...aiTiers.filter((tier) => tier.active).map((tier) => ({ value: tier.key, label: tier.label || tier.key })),
  ]

  return (
    <SettingCardList>
      {PACKAGE_KEYS.map((pkg) => {
        const baseline = baselines[pkg]
        const aiKey = baseline?.ai_tier_key ?? ''
        // Package-qualified names: three identical controls would be indistinguishable to a screen reader (§6).
        const pkgLabel = t(`billingBudgets.package.${pkg}`, { defaultValue: pkg })
        return (
          <SettingRow key={pkg} label={pkgLabel}
            description={`${t('billingTiers.includesRuns')} · ${t('billingTiers.includesAiTier')}`}>
            <NumberField value={baseline?.workflow_runs ?? 0} min={0} width={110} disabled={disabled}
              ariaLabel={`${t('billingTiers.includesRuns')}: ${pkgLabel}`}
              onChange={(v: number) => onChange(pkg, { workflow_runs: v })} />
            <SearchSelect
              triggerLabel={aiOptions.find((o) => o.value === aiKey)?.label ?? t('billingTiers.includesAiNone')}
              options={aiOptions}
              selected={[aiKey]}
              onToggle={(value) => onChange(pkg, { ai_tier_key: value === '' ? null : (value as BillingPackageBaseline['ai_tier_key']) })}
              closeOnToggle selectAll={false}
              disabled={disabled}
              triggerAriaLabel={`${t('billingTiers.includesAiTier')}: ${pkgLabel}`}
            />
          </SettingRow>
        )
      })}
    </SettingCardList>
  )
}
