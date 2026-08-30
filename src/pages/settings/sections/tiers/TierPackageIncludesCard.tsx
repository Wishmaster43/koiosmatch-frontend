/**
 * TierPackageIncludesCard (PRIJSMODEL-C DEEL C, task E2) — what each of the
 * three packages includes by default: a monthly workflow-run allowance and an
 * optional AI baseline tier. Props-only presenter (mirrors TierCatalogTable/
 * TierPlatformTogglesCard — no outer card/heading, the parent supplies both);
 * the parent container owns GET/PUT and the SaveButton.
 */
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { GroupLabel } from '@/components/ui/typography'
import { PACKAGE_KEYS, label, inputWrap, inputStyle } from '../billingCardStyles'
import type { BillingAiTier, BillingPackageBaseline, BillingPackageKey } from '@/types/billingTiers'

interface Props {
  baselines: Partial<Record<BillingPackageKey, BillingPackageBaseline>>
  aiTiers: BillingAiTier[]
  onChange: (pkg: BillingPackageKey, patch: Partial<BillingPackageBaseline>) => void
  disabled?: boolean
}

// One row of the three packages: an editable runs number + a single-pick AI tier.
export default function TierPackageIncludesCard({ baselines, aiTiers, onChange, disabled }: Props) {
  const { t } = useTranslation('settings')

  // Only active tiers are pickable — an inactive tier is not a valid baseline choice.
  const aiOptions = [
    { value: '', label: t('billingTiers.includesAiNone') },
    ...aiTiers.filter((tier) => tier.active).map((tier) => ({ value: tier.key, label: tier.label || tier.key })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {PACKAGE_KEYS.map((pkg) => {
        const baseline = baselines[pkg]
        const aiKey = baseline?.ai_tier_key ?? ''
        // Package-qualified names: three identical "Workflow-runs" controls would be indistinguishable to a screen reader (§6).
        const pkgLabel = t(`billingBudgets.package.${pkg}`, { defaultValue: pkg })
        return (
          <div key={pkg} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <GroupLabel style={{ marginBottom: 8 }}>
              {t(`billingBudgets.package.${pkg}`, { defaultValue: pkg })}
            </GroupLabel>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={label} htmlFor={`tier-includes-runs-${pkg}`}>{t('billingTiers.includesRuns')}</label>
                <div style={inputWrap}>
                  <input id={`tier-includes-runs-${pkg}`} type="number" min={0} step={1}
                    aria-label={`${t('billingTiers.includesRuns')}: ${pkgLabel}`}
                    value={baseline?.workflow_runs ?? ''}
                    disabled={disabled}
                    onChange={(e) => onChange(pkg, { workflow_runs: e.target.value === '' ? undefined : Number(e.target.value) })}
                    style={inputStyle} />
                </div>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                <label style={label} id={`tier-includes-ai-label-${pkg}`}>{t('billingTiers.includesAiTier')}</label>
                <SearchSelect
                  triggerLabel={aiOptions.find((o) => o.value === aiKey)?.label ?? t('billingTiers.includesAiNone')}
                  options={aiOptions}
                  selected={[aiKey]}
                  onToggle={(value) => onChange(pkg, { ai_tier_key: value === '' ? null : (value as BillingPackageBaseline['ai_tier_key']) })}
                  closeOnToggle selectAll={false}
                  disabled={disabled}
                  triggerAriaLabel={`${t('billingTiers.includesAiTier')}: ${pkgLabel}`}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
