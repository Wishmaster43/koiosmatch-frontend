import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

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

export default function BlacklistReasonsSettings({ entity = 'candidate' }) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* withIcon (batch 12, P22-30): same curated generic icon set as every other lookup. */}
      <StatusListEditor title={t(`blacklistReasons.${entity}.title`)}
        subtitle={t(`blacklistReasons.${entity}.subtitle`)}
        endpoint={ENDPOINTS[entity]} addLabel={t('blacklistReasons.add')} withColor withIcon />
    </div>
  )
}
