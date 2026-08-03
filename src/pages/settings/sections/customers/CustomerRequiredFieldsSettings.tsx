/**
 * CustomerRequiredFieldsSettings — Settings → Klanten → Verplichte velden (KLANT-VERPLICHT-1).
 * Danny: "ik zie ook nog geen verplichte velden bij klant en prospect … maar ook bij
 * Contactpersoon, locatie en afdeling." The backend already enforces this
 * (CustomerRequiredFieldsGuard + FlatRequiredFieldsGuard, wired into all four
 * controllers on create AND update) — only this editor was missing.
 *
 * Four sub-tabs, one per guarded entity: Klant is phase-aware
 * (CustomerPhaseRequiredFieldsMatrix, `customer_required_fields` = { phase: [field] });
 * Locatie/Afdeling/Contactpersoon have no phase axis, so they render the shared flat
 * toggle list against their own flat `{entity}_required_fields` array — mirrors
 * FlatRequiredFieldsGuard's "one class, three entity tokens" shape on the frontend.
 *
 * Every catalog field label REUSES an existing i18n key already shown elsewhere for
 * that same field (create modals / drawer detail views) — see requiredFieldsCatalog.ts
 * — so this screen never mints a second translated copy of e.g. "KvK-nummer".
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomerPhaseRequiredFieldsMatrix from './CustomerPhaseRequiredFieldsMatrix'
import FlatRequiredFieldsToggleList from './FlatRequiredFieldsToggleList'
import { CUSTOMER_CONTACT_FIELDS, CUSTOMER_LOCATION_FIELDS, CUSTOMER_DEPARTMENT_FIELDS } from './requiredFieldsCatalog'

type TabId = 'customer' | 'location' | 'department' | 'contact'

export default function CustomerRequiredFieldsSettings() {
  const { t } = useTranslation('settings')
  const [active, setActive] = useState<TabId>('customer')

  // One sub-tab per guarded entity, reusing the shared underline SubTabBar.
  const tabs = [
    { id: 'customer', label: t('customerRequiredFields.tabs.customer') },
    { id: 'location', label: t('customerRequiredFields.tabs.location') },
    { id: 'department', label: t('customerRequiredFields.tabs.department') },
    { id: 'contact', label: t('customerRequiredFields.tabs.contact') },
  ]

  return (
    <div style={{ maxWidth: 760 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('customerRequiredFields.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('customerRequiredFields.subtitle')}</p>

      <SubTabBar tabs={tabs} active={active} onChange={id => setActive(id as TabId)} />
      <div style={{ marginTop: 14 }}>
        {active === 'customer' && <CustomerPhaseRequiredFieldsMatrix />}
        {active === 'location' && (
          <FlatRequiredFieldsToggleList settingKey="customer_location_required_fields"
            fields={CUSTOMER_LOCATION_FIELDS} hintKey="customerRequiredFields.flatHint" />
        )}
        {active === 'department' && (
          <FlatRequiredFieldsToggleList settingKey="customer_department_required_fields"
            fields={CUSTOMER_DEPARTMENT_FIELDS} hintKey="customerRequiredFields.flatHint" />
        )}
        {active === 'contact' && (
          <FlatRequiredFieldsToggleList settingKey="customer_contact_required_fields"
            fields={CUSTOMER_CONTACT_FIELDS} hintKey="customerRequiredFields.flatHint" />
        )}
      </div>
    </div>
  )
}
