/**
 * CustomerDisplaySettings — the customer table's display preferences, split into
 * per-entity sub-tabs (Danny 02-08: "afdelingen, locaties en contactpersonen moeten
 * sub-tabjes worden, en duidelijk dat het van de drill-down is", i.e. "departments,
 * locations and contacts must become sub-tabs, and it must be clear that it's
 * from the drill-down"). Before this, all
 * eleven settings sat in one flat list with no way to tell which ones affected the
 * customer TABLE (the list you land on) versus the sub-entity tables you only see
 * once a customer is open — mirrors VacancyCandidateTabSettings' shape (shared
 * SubTabBar, one block per tab).
 *
 * Tab naming reuses the product's OWN vocabulary rather than inventing new jargon:
 * "Klantenlijst"/"Customer list" extends the existing `nav.customers` label, and
 * "Locaties"/"Afdelingen"/"Contactpersonen"/"Vacatures" are the EXACT drawer tab
 * names (`customers:drawer.tabs.*`) a recruiter already recognises — never the
 * internal word "drill-down". Each tab's subtitle says in one line where its
 * settings take effect, so nobody has to open a customer to find out.
 *
 * The three sub-entity tabs mix TWO controls: the existing schema-driven display
 * toggles (unchanged keys/defaults, only regrouped — see customerDisplay.js) with
 * their own dirty-tracking Save button, and the NEW tenant default-status-filter
 * picker below a divider (`DefaultStatusFilterPicker` — the shared `SelectMenu`
 * dropdown, this product's own pattern for "pick one from a tenant lookup"),
 * which persists immediately since it is not part of that form. Vacatures has no
 * display-colour keys of its own (that lives on the vacancy entity's own settings
 * screen) — only the default-filter picker.
 *
 * TASKS/OPPORTUNITIES-1 (this task): two more sub-tabs, "Taken" and "Kansen",
 * following the same shape as the three above — a single colour-on/off toggle
 * each (`customer_task_table_color_status` / `customer_opportunity_table_color_stage`),
 * no `DefaultStatusFilterPicker`. Unlike locations/departments/contacts/vacancies,
 * neither of these two got a tenant-default-filter setting: that was not part of
 * this change's brief, so it stays a documented gap rather than invented scope —
 * a natural follow-up if Danny wants full parity with the other three tabs.
 *
 * TENANT-DEFAULT-1 (Danny 02-08) update: "Kansen" was originally DROPPED here
 * because OpportunitiesTab filtered by pipeline stage with no StatusFilterSelect
 * at all — Danny later asked for that filter back ("bij Kansen mis ik ook nog de
 * statussen", i.e. "on Opportunities I'm also still missing the statuses"), so
 * OpportunitiesTab now has one, keyed on `stage`. See
 * TASKS/OPPORTUNITIES-1 above for what landed instead of the default-filter picker.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useAllSettings, getStringSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import SchemaSection from '../components/SchemaSection'
import DefaultStatusFilterPicker from '../components/DefaultStatusFilterPicker'
import customerDisplay from '../schemas/customerDisplay'

// Build one tab's schema variant: same field definitions (customerDisplay stays the
// single source of truth for keys/defaults), filtered to this tab's `group`, with
// its own title/subtitle so each tab reads as its own screen, not a shared one.
const tabSchema = (group, tab) => ({
  ...customerDisplay,
  fields: customerDisplay.fields.filter(f => f.group === group),
  titleI18n: `customerDisplay.tabs.${tab}.title`,
  subtitleI18n: `customerDisplay.tabs.${tab}.subtitle`,
})

// Visual divider between the schema-driven toggle block (its own Save button) and
// the immediate-persist default-filter picker below it — two different persistence
// models on one tab, so the seam must read as a clear break, not one continuous form.
const filterDivider = { marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }

export default function CustomerDisplaySettings() {
  // Vacancy statuses need their own provider here — VacancyLookupsProvider is only
  // mounted around the Vacancies page elsewhere (mirrors VacancyCandidateTabSettings).
  return (
    <VacancyLookupsProvider>
      <CustomerDisplaySettingsInner />
    </VacancyLookupsProvider>
  )
}

// The actual settings body, rendered inside its own VacancyLookupsProvider (see the wrapper above).
function CustomerDisplaySettingsInner() {
  const { t } = useTranslation('settings')
  const { locationStatuses, departmentStatuses, contactStatuses } = useCustomerLookups()
  const { statuses: vacancyStatuses } = useVacancyLookups()
  const settings = useAllSettings()

  // Seven sub-tabs, reusing the shared underline SubTabBar (VacancyCandidateTabSettings' shape).
  const [activeTab, setActiveTab] = useState('customer_table')
  const tabs = [
    { id: 'customer_table', label: t('customerDisplay.tabs.customerTable.title') },
    { id: 'locations', label: t('customerDisplay.tabs.locations.title') },
    { id: 'departments', label: t('customerDisplay.tabs.departments.title') },
    { id: 'contacts', label: t('customerDisplay.tabs.contacts.title') },
    { id: 'vacancies', label: t('customerDisplay.tabs.vacancies.title') },
    { id: 'tasks', label: t('customerDisplay.tabs.tasks.title') },
    { id: 'opportunities', label: t('customerDisplay.tabs.opportunities.title') },
  ]

  // Immediate-persist setter for one tab's default-filter key — always the exact key,
  // never a partial merge risk (mirrors VacancyCandidateTabSettings' persist()).
  const setDefaultFilter = (key) => (val) => saveSettingsKeys({ [key]: val }).catch(() => {})

  return (
    <div style={{ maxWidth: 720 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 14 }}>
        {activeTab === 'customer_table' && (
          <SchemaSection schema={tabSchema('customer_table', 'customerTable')} />
        )}

        {activeTab === 'locations' && (
          <>
            <SchemaSection schema={tabSchema('locations', 'locations')} />
            <div style={filterDivider}>
              <DefaultStatusFilterPicker statuses={locationStatuses}
                value={getStringSetting(settings, 'customer_location_default_status_filter')}
                onChange={setDefaultFilter('customer_location_default_status_filter')} />
            </div>
          </>
        )}

        {activeTab === 'departments' && (
          <>
            <SchemaSection schema={tabSchema('departments', 'departments')} />
            <div style={filterDivider}>
              <DefaultStatusFilterPicker statuses={departmentStatuses}
                value={getStringSetting(settings, 'customer_department_default_status_filter')}
                onChange={setDefaultFilter('customer_department_default_status_filter')} />
            </div>
          </>
        )}

        {activeTab === 'contacts' && (
          <>
            <SchemaSection schema={tabSchema('contacts', 'contacts')} />
            <div style={filterDivider}>
              <DefaultStatusFilterPicker statuses={contactStatuses}
                value={getStringSetting(settings, 'customer_contact_default_status_filter')}
                onChange={setDefaultFilter('customer_contact_default_status_filter')} />
            </div>
          </>
        )}

        {activeTab === 'vacancies' && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {t('customerDisplay.tabs.vacancies.title')}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {t('customerDisplay.tabs.vacancies.subtitle')}
            </p>
            <DefaultStatusFilterPicker statuses={vacancyStatuses}
              value={getStringSetting(settings, 'customer_vacancy_default_status_filter')}
              onChange={setDefaultFilter('customer_vacancy_default_status_filter')} />
          </div>
        )}

        {/* Taken — a single colour toggle, no default-filter picker (TASKS/OPPORTUNITIES-1). */}
        {activeTab === 'tasks' && (
          <SchemaSection schema={tabSchema('tasks', 'tasks')} />
        )}

        {/* Kansen — a single colour toggle; the stage filter itself has no tenant-default
            setting yet (TASKS/OPPORTUNITIES-1). */}
        {activeTab === 'opportunities' && (
          <SchemaSection schema={tabSchema('opportunities', 'opportunities')} />
        )}
      </div>
    </div>
  )
}
