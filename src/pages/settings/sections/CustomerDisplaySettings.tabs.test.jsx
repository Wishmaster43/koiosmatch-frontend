/**
 * CustomerDisplaySettings — the sub-tabbed registry component (SUB-TABS-1, Danny
 * 02-08). Named `.tabs.test.jsx`, separate from `CustomerDisplaySettings.test.jsx`
 * (which exercises the generic `SchemaSection` mechanics directly against the flat
 * `customerDisplay` schema and is untouched by this split). This file is the
 * regression guard for the split itself: every one of the eleven existing keys
 * must still be reachable from SOME tab (a key that quietly disappeared from the
 * UI is the exact failure mode this task warns about), sub-tabs must actually
 * switch content, and the NEW per-tab default-status-filter picker must show up
 * only where a drill-down tab really has a status filter (not on Klantenlijst).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CustomerDisplaySettings from './CustomerDisplaySettings'
import customerDisplay from '../schemas/customerDisplay'

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// `/settings` resolves to an (empty) controllable blob for both SchemaSection's own
// dirty-tracking form AND useAllSettings/useSettingsLoaded. Every OTHER lookup
// endpoint (customer sub-statuses, vacancy statuses) is left pending forever, so
// each provider/hook sticks to its own synchronous seed defaults — mirrors
// VacancyCandidateTabSettings.test.jsx's own mocking shape.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn((url) => (url === '/settings' ? Promise.resolve({ data: {} }) : new Promise(() => {}))),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

afterEach(() => vi.clearAllMocks())

const tabLabel = (id) => t(`customerDisplay.tabs.${id}.title`)

describe('CustomerDisplaySettings · five sub-tabs, correctly named', () => {
  it('renders one tab per group, using the drawer/nav vocabulary (never "drill-down")', () => {
    render(<CustomerDisplaySettings />)
    const tablist = screen.getByRole('tablist')
    ;['customerTable', 'locations', 'departments', 'contacts', 'vacancies'].forEach(id => {
      expect(screen.getByRole('tab', { name: tabLabel(id) })).toBeInTheDocument()
    })
    expect(tablist.textContent?.toLowerCase()).not.toContain('drill-down')
  })

  it('opens on the customer-table tab by default', () => {
    render(<CustomerDisplaySettings />)
    expect(screen.getByRole('tab', { name: tabLabel('customerTable') })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('CustomerDisplaySettings · switching tabs shows the right settings', () => {
  it('shows the customer-table fields on the first tab, and hides a Locaties-only field', async () => {
    const user = userEvent.setup()
    render(<CustomerDisplaySettings />)
    // SchemaSection's own useSettingsForm loads /settings asynchronously (skeleton
    // first) — wait past it before asserting on the FIRST tab, which renders with no
    // prior click to await on.
    await waitFor(() => expect(screen.getByText(t('customerDisplay.fields.customer_table_color_status.label'))).toBeInTheDocument())
    expect(screen.queryByText(t('customerDisplay.fields.customer_location_chip_color.label'))).toBeNull()

    await user.click(screen.getByRole('tab', { name: tabLabel('locations') }))
    expect(screen.getByText(t('customerDisplay.fields.customer_location_chip_color.label'))).toBeInTheDocument()
    // The customer-table-only field is gone now that Locaties is active.
    expect(screen.queryByText(t('customerDisplay.fields.customer_table_color_status.label'))).toBeNull()
  })

  it('shows the Afdelingen fields only on the Afdelingen tab', async () => {
    const user = userEvent.setup()
    render(<CustomerDisplaySettings />)
    await user.click(screen.getByRole('tab', { name: tabLabel('departments') }))
    expect(screen.getByText(t('customerDisplay.fields.customer_department_chip_color.label'))).toBeInTheDocument()
    expect(screen.getByText(t('customerDisplay.fields.customer_department_table_color_location.label'))).toBeInTheDocument()
    expect(screen.getByText(t('customerDisplay.fields.customer_department_table_color_status.label'))).toBeInTheDocument()
  })

  it('shows the Contactpersonen fields only on the Contactpersonen tab', async () => {
    const user = userEvent.setup()
    render(<CustomerDisplaySettings />)
    await user.click(screen.getByRole('tab', { name: tabLabel('contacts') }))
    expect(screen.getByText(t('customerDisplay.fields.customer_contact_table_color_location.label'))).toBeInTheDocument()
    expect(screen.getByText(t('customerDisplay.fields.customer_contact_table_color_department.label'))).toBeInTheDocument()
    expect(screen.getByText(t('customerDisplay.fields.customer_contact_table_color_status.label'))).toBeInTheDocument()
  })
})

describe('CustomerDisplaySettings · every one of the eleven keys is still reachable', () => {
  it.each(customerDisplay.fields.map(f => [f.key, f.group]))('%s (group: %s) renders its label on its own tab', async (key, group) => {
    const user = userEvent.setup()
    render(<CustomerDisplaySettings />)
    if (group !== 'customer_table') {
      await user.click(screen.getByRole('tab', { name: tabLabel(group) }))
    }
    // Each tab switch mounts a FRESH SchemaSection (its own useSettingsForm, its own
    // /settings load) — wait past the skeleton rather than assume the click's own
    // await already flushed this render's fetch too.
    await waitFor(() => expect(screen.getByText(t(`customerDisplay.fields.${key}.label`))).toBeInTheDocument())
  })
})

describe('CustomerDisplaySettings · the default-status-filter picker only where a filter really exists', () => {
  it('does NOT show a default-filter picker on Klantenlijst — the customer table has none', () => {
    render(<CustomerDisplaySettings />)
    expect(screen.queryByText(t('customerDisplay.defaultFilter.title'))).toBeNull()
  })

  it('shows the default-filter picker on Locaties, Afdelingen, Contactpersonen and Vacatures', async () => {
    const user = userEvent.setup()
    render(<CustomerDisplaySettings />)
    for (const id of ['locations', 'departments', 'contacts', 'vacancies']) {
      await user.click(screen.getByRole('tab', { name: tabLabel(id) }))
      expect(screen.getByText(t('customerDisplay.defaultFilter.title'))).toBeInTheDocument()
    }
  })

  it('never offers a Kansen tab — OpportunitiesTab has no status filter to replace', () => {
    render(<CustomerDisplaySettings />)
    expect(screen.queryByRole('tab', { name: /Kansen|Opportunities|Chancen|Opportunités|Oportunidades/i })).toBeNull()
  })
})
