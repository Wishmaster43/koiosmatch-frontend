import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import Toggle from '@/components/ui/Toggle'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { useAllSettings, useSettingsLoaded, getBoolSetting, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

/**
 * BlacklistReasonsSettings — blacklist-reason lookup for ONE entity that carries a
 * blacklist deployability status: candidate (candidates.blacklist_reason) or customer
 * (customers.blacklist_reason). Parameterized by `entity` and registered per owning
 * group ("klant bij klant, kandidaat bij kandidaat", Danny 2026-08-05) — the earlier
 * two-sub-tabs-under-candidates shape put customer config in the wrong menu.
 *
 * Endpoints (backend core-lookups.php): candidate uses the renamed
 * `/candidate-blacklist-reasons` (the old `/blacklist-reasons` stays only as a
 * temporary FE-migration alias, BLACKLIST-RENAME); customer uses
 * `/customer-blacklist-reasons` (KLANT-BLACKLIST-1). Both gained sort_order +
 * PUT /{endpoint}/reorder on 2026-08-04 (BE b649f8f0) — reorder is real now,
 * so the old reorderable={false} audit note no longer applies.
 */
const ENDPOINTS = {
  candidate: '/candidate-blacklist-reasons',
  customer: '/customer-blacklist-reasons',
}

// Tenant setting key that the BE guard reads (CandidateStatusGuard / CustomerStatusGuard) —
// per-entity, defaults ON (a reason is required until a tenant switches it off).
const REQUIRED_KEYS = {
  candidate: 'blacklist_reason_required',
  customer: 'customer_blacklist_reason_required',
}

export default function BlacklistReasonsSettings({ entity = 'candidate' }) {
  const { t } = useTranslation(['settings', 'common'])
  const settings = useAllSettings()
  const key = REQUIRED_KEYS[entity]
  // The blob starts as {} (never null), so `required` shows its default until the first
  // GET resolves: the Toggle stays disabled until then (REQFIELDS-TOGGLE-RACE-1 idiom).
  const loaded = useSettingsLoaded()
  const required = getBoolSetting(settings, key, true)

  // Persist the toggle immediately (settings idiom: write the exact key, invalidate the
  // shared cache, surface a toast on failure) — mirrors CandidateCommSettings.
  const onToggle = async (v) => {
    try {
      await saveSettingsKeys({ [key]: v })
      invalidateAllSettingsCache()
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Tenant switch for the reason-required guard (BLACKLIST-TOGGLE-1) — sits above
          the reason lookup so the two blacklist-reason controls stay together. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
                    border: '1px solid var(--border)', borderRadius: 8, marginBottom: 'var(--space-4)' }}>
        <Toggle checked={required} onChange={onToggle} disabled={!loaded}
          ariaLabel={t('blacklistReasons.requiredToggle.label')} />
        <div>
          <SectionTitle style={{ marginBottom: 2 }}>{t('blacklistReasons.requiredToggle.label')}</SectionTitle>
          <Caption>{t('blacklistReasons.requiredToggle.hint')}</Caption>
        </div>
      </div>
      {/* withIcon (batch 12, P22-30): same curated generic icon set as every other lookup. */}
      <StatusListEditor title={t(`blacklistReasons.${entity}.title`)}
        subtitle={t(`blacklistReasons.${entity}.subtitle`)}
        endpoint={ENDPOINTS[entity]} addLabel={t('blacklistReasons.add')} withColor withIcon />
    </div>
  )
}
