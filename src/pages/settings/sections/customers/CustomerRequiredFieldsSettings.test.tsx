/**
 * CustomerRequiredFieldsSettings (KLANT-VERPLICHT-1) — Danny: "ik zie ook nog geen
 * verplichte velden bij klant en prospect … maar ook bij Contactpersoon, locatie en
 * afdeling." §13: every save assertion checks the REQUEST (settings POST body/key/
 * shape), never only that a callback fired.
 *
 * Uses two tenant phases (mirrors AddCustomerModal.test.tsx's own mock shape) so the
 * "column per tenant phase" assertion is meaningful — a hardcoded Prospect/Klant pair
 * would pass even if the component ignored the lookup entirely.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CustomerRequiredFieldsSettings from './CustomerRequiredFieldsSettings'

// Resolve the active locale's own copy for the NEW settings-namespace keys this screen
// introduces (tab labels/hints) — mirrors CustomerDisplaySettings.test.jsx's `st()` helper,
// so the assertion tracks whatever the real bundle says rather than a guessed string.
const st = (key: string) => i18n.t(key, { ns: 'settings' })

// Route the shared settings loader: the blob is controlled per test; saves go
// through the REAL saveSettingsKeys so the api.post seam is asserted (mirrors
// CareerSiteSettings.test.jsx / VacancyCandidateTabSettings.test.jsx).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  // Settings count as loaded here — the pending-state race has its own dedicated
  // tests (FlatRequiredFieldsToggleList.test.tsx / ApplicationRequiredFieldsSettings.test.tsx).
  return { ...actual, useAllSettings: () => blobRef.current, useSettingsLoaded: () => true }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
// getActiveTenantId is the real (unmocked, via importActual above) useAllSettings
// module's tenant-scope key — saves go through the real saveSettingsKeys.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))

// Two named tenant phases — never the hardcoded Prospect/Klant seed.
/* eslint-disable no-restricted-syntax -- DATA: mock lookup colours mirroring AddCustomerModal.test.tsx's own phase mock, not a UI colour choice */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'lead_fase', label: 'Lead-fase', color: '#1B60A9', isCustomer: false, isDefault: true },
      { value: 'klant_fase', label: 'Klant-fase', color: '#16A34A', isCustomer: true, isDefault: false },
    ],
    phaseMeta: () => ({ value: '', label: '', color: '#9CA3AF', isCustomer: false, isDefault: false }),
    defaultPhase: 'lead_fase',
    isCustomerPhase: () => false,
    loading: false,
  }),
}))
/* eslint-enable no-restricted-syntax */

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

describe('CustomerRequiredFieldsSettings — Klant tab (phase matrix)', () => {
  it('renders one column per tenant phase, not a hardcoded pair', () => {
    render(<CustomerRequiredFieldsSettings />)
    expect(screen.getByRole('columnheader', { name: 'Lead-fase' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Klant-fase' })).toBeInTheDocument()
  })

  it('toggling a cell POSTs the phase-keyed map shape, not a flat array', async () => {
    const user = userEvent.setup()
    render(<CustomerRequiredFieldsSettings />)
    const nameRow = screen.getByText('Naam').closest('tr')!
    // PermissionToggle renders the shared Toggle (role=switch, audit finding 05-08) —
    // was a plain <button> before that fix.
    const cells = within(nameRow).getAllByRole('switch')
    await user.click(cells[0]) // first phase column = Lead-fase
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_required_fields: JSON.stringify({ lead_fase: ['name'] }) })
  })

  it('a stored required field renders its toggle as ON (round trip)', () => {
    blobRef.current = { customer_required_fields: { klant_fase: ['name'] } }
    render(<CustomerRequiredFieldsSettings />)
    // Semantic state, never the paint (same swap as ApplicationRequiredFieldsSettings.test.tsx).
    expect(screen.getByRole('switch', { name: 'Naam — Klant-fase' })).toBeChecked()
  })
})

describe('CustomerRequiredFieldsSettings — flat sub-entity tabs', () => {
  it('Locatie tab toggling POSTs a flat array under customer_location_required_fields', async () => {
    const user = userEvent.setup()
    render(<CustomerRequiredFieldsSettings />)
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.location') }))
    await user.click(screen.getByRole('switch', { name: 'Naam' }))
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_location_required_fields: JSON.stringify(['name']) })
  })

  it('Afdeling tab toggling POSTs a flat array under customer_department_required_fields', async () => {
    const user = userEvent.setup()
    render(<CustomerRequiredFieldsSettings />)
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.department') }))
    await user.click(screen.getByRole('switch', { name: 'Naam' }))
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_department_required_fields: JSON.stringify(['name']) })
  })

  it('Contactpersoon tab toggling POSTs a flat array under customer_contact_required_fields', async () => {
    const user = userEvent.setup()
    render(<CustomerRequiredFieldsSettings />)
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.contact') }))
    await user.click(screen.getByRole('switch', { name: 'Voornaam' }))
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_contact_required_fields: JSON.stringify(['first_name']) })
  })

  it('a stored flat value renders its toggle as ON (round trip)', async () => {
    const user = userEvent.setup()
    blobRef.current = { customer_location_required_fields: ['name'] }
    render(<CustomerRequiredFieldsSettings />)
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.location') }))
    expect(screen.getByRole('switch', { name: 'Naam' })).toBeChecked()
  })
})
