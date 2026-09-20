/**
 * CustomerRequiredFieldsSettings — Settings → Customers → Required fields (KLANT-VERPLICHT-1).
 * Danny: "I still don't see required fields for customer and prospect … but also for
 * Contact, location and department." The backend already enforces this
 * (CustomerRequiredFieldsGuard + FlatRequiredFieldsGuard, wired into all four
 * controllers on create AND update) — only this editor was missing.
 *
 * Four sub-tabs, one per guarded entity: Customer is phase-aware
 * (CustomerPhaseRequiredFieldsMatrix, `customer_required_fields` = { phase: [field] });
 * Location/Department/Contact have no phase axis, so they render the shared flat
 * toggle list against their own flat `{entity}_required_fields` array — mirrors
 * FlatRequiredFieldsGuard's "one class, three entity tokens" shape on the frontend.
 *
 * Every catalog field label REUSES an existing i18n key already shown elsewhere for
 * that same field (create modals / drawer detail views) — see requiredFieldsCatalog.ts
 * — so this screen never mints a second translated copy of e.g. "KvK-nummer".
 *
 * The three flat tabs' ROWS come from the live `GET /settings/field-inventory` catalogue
 * (VERPLICHTE-VELDEN-INVENTARIS-1, useFieldInventory) instead of the static whitelist
 * arrays directly — one call for whichever flat tab is active, filtered on
 * `requires_permission` and carrying `requirable`/`reason` through to the toggle list.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomerPhaseRequiredFieldsMatrix from './CustomerPhaseRequiredFieldsMatrix'
import FlatRequiredFieldsToggleList from './FlatRequiredFieldsToggleList'
import { CUSTOMER_CONTACT_FIELD_LABEL_KEYS, CUSTOMER_LOCATION_FIELD_LABEL_KEYS, CUSTOMER_DEPARTMENT_FIELD_LABEL_KEYS } from './requiredFieldsCatalog'
import { buildInventoryRows } from '@/pages/settings/requiredFieldsReason'
import { useFieldInventory, type FieldInventoryEntity } from '@/pages/settings/hooks/useFieldInventory'
import { useSafePermission } from '@/hooks/useSafePermission'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { BodyText } from '@/components/ui/typography'

type TabId = 'customer' | 'location' | 'department' | 'contact'

// Flat-tab id -> inventory entity + its label map, so the container fetches and labels
// the right row set for whichever flat tab is active.
const FLAT_TAB_CONFIG: Record<Exclude<TabId, 'customer'>, { entity: FieldInventoryEntity; labelKeys: Record<string, string>; settingKey: string }> = {
  location: { entity: 'customer_location', labelKeys: CUSTOMER_LOCATION_FIELD_LABEL_KEYS, settingKey: 'customer_location_required_fields' },
  department: { entity: 'customer_department', labelKeys: CUSTOMER_DEPARTMENT_FIELD_LABEL_KEYS, settingKey: 'customer_department_required_fields' },
  contact: { entity: 'customer_contact', labelKeys: CUSTOMER_CONTACT_FIELD_LABEL_KEYS, settingKey: 'customer_contact_required_fields' },
}

// Sub-tab container for the customer/location/department/contact required-fields
// matrices, reusing the shared field catalogue (see the module doc comment above).
export default function CustomerRequiredFieldsSettings() {
  const { t } = useTranslation('settings')
  const hasPermission = useSafePermission()
  const [active, setActive] = useState<TabId>('customer')

  // One sub-tab per guarded entity, reusing the shared underline SubTabBar.
  const tabs = [
    { id: 'customer', label: t('customerRequiredFields.tabs.customer') },
    { id: 'location', label: t('customerRequiredFields.tabs.location') },
    { id: 'department', label: t('customerRequiredFields.tabs.department') },
    { id: 'contact', label: t('customerRequiredFields.tabs.contact') },
  ]

  // A single inventory fetch for whichever flat tab is active (the phase matrix fetches
  // its own 'customer' inventory internally). The entity picked here is only rendered
  // when `active` is a flat tab — see the `active !== 'customer'` guard below.
  const flatConfig = active === 'customer' ? FLAT_TAB_CONFIG.location : FLAT_TAB_CONFIG[active]
  const { fields: inventoryFields, isLoading, isError, refetch } = useFieldInventory(flatConfig.entity)
  // Shared builder (§11): translates the raw English `reason` too — see the phase matrix.
  const flatRows = buildInventoryRows(inventoryFields, flatConfig.labelKeys, hasPermission, t)

  return (
    <div style={{ maxWidth: 760 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('customerRequiredFields.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('customerRequiredFields.subtitle')}</p>

      <SubTabBar tabs={tabs} active={active} onChange={id => setActive(id as TabId)} />
      <div style={{ marginTop: 14 }}>
        {active === 'customer' && <CustomerPhaseRequiredFieldsMatrix />}
        {active !== 'customer' && isLoading && (
          <div style={{ padding: 24, textAlign: 'center' }}><Spinner label={t('common:loading')} /></div>
        )}
        {active !== 'customer' && !isLoading && isError && (
          <ErrorBanner onRetry={() => { void refetch() }}>{t('requiredFields.inventoryLoadFailed')}</ErrorBanner>
        )}
        {active !== 'customer' && !isLoading && !isError && flatRows.length === 0 && (
          <BodyText style={{ color: 'var(--text-muted)' }}>{t('customerRequiredFields.empty')}</BodyText>
        )}
        {active !== 'customer' && !isLoading && !isError && flatRows.length > 0 && (
          <FlatRequiredFieldsToggleList settingKey={flatConfig.settingKey}
            fields={flatRows} hintKey="customerRequiredFields.flatHint" />
        )}
      </div>
    </div>
  )
}
