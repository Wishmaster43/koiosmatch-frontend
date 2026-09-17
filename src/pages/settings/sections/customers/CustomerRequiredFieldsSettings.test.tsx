/**
 * CustomerRequiredFieldsSettings (KLANT-VERPLICHT-1, VERPLICHTE-VELDEN-INVENTARIS-1) —
 * Danny: "ik zie ook nog geen verplichte velden bij klant en prospect … maar ook bij
 * Contactpersoon, locatie en afdeling." §13: every save assertion checks the REQUEST
 * (settings POST body/key/shape), never only that a callback fired.
 *
 * Rows now come from the live `GET /settings/field-inventory?entity=…` catalogue
 * (useFieldInventory) instead of the static whitelist directly, so the api.get mock
 * below stands in for that endpoint, keyed by the `entity` query param.
 *
 * Uses two tenant phases (mirrors AddCustomerModal.test.tsx's own mock shape) so the
 * "column per tenant phase" assertion is meaningful — a hardcoded Prospect/Klant pair
 * would pass even if the component ignored the lookup entirely.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import CustomerRequiredFieldsSettings from './CustomerRequiredFieldsSettings'

// Resolve the active locale's own copy for the NEW settings-namespace keys this screen
// introduces (tab labels/hints) — mirrors CustomerDisplaySettings.test.jsx's `st()` helper,
// so the assertion tracks whatever the real bundle says rather than a guessed string.
const st = (key: string) => i18n.t(key, { ns: 'settings' })

// One field-inventory row, defaulting to a plain requirable/no-permission field.
function invField(overrides: Partial<{
  key: string; group: string; requirable: boolean; requires_permission: string | null; reason: string | null
}>) {
  return {
    key: overrides.key!, group: overrides.group ?? 'general', type: 'string',
    requirable: overrides.requirable ?? true, creatable: true, writable: true,
    internal_name: overrides.key!, external_name: overrides.key!, aliases: [],
    requires_permission: overrides.requires_permission ?? null, reason: overrides.reason ?? null,
  }
}

// Per-entity field-inventory fixtures, extended per test with the three inventory cases
// (a requirable row, a `requirable:false` row with a reason, a `requires_permission` row).
const INVENTORY: Record<string, ReturnType<typeof invField>[]> = {
  customer: [
    invField({ key: 'name' }),
    invField({ key: 'status_id', requirable: false, reason: 'webhook-stamped' }),
    invField({ key: 'salary_band', requires_permission: 'settings.finance.view' }),
  ],
  customer_location: [invField({ key: 'name' })],
  customer_department: [invField({ key: 'name' })],
  customer_contact: [invField({ key: 'first_name' })],
}

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
// GET /settings/field-inventory: resolves from the fixture above, keyed by `params.entity`.
const getMock = vi.hoisted(() => vi.fn((_url: string, config?: { params?: { entity?: string } }) => {
  const entity = config?.params?.entity ?? 'customer'
  return Promise.resolve({ data: { data: { entity, groups: [{ key: 'general', label_key: 'x' }], fields: INVENTORY_REF.current[entity] ?? [] } } })
}))
const INVENTORY_REF = vi.hoisted(() => ({ current: {} as Record<string, ReturnType<typeof invField>[]> }))
// getActiveTenantId is the real (unmocked, via importActual above) useAllSettings
// module's tenant-scope key — saves go through the real saveSettingsKeys.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: getMock, post: postMock }, getActiveTenantId: vi.fn(() => null) }
})

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

// A signed-in caller without the finance permission by default — the permission-gated
// inventory case flips this per test.
const hasPermissionRef = vi.hoisted(() => ({ current: (() => false) as () => boolean }))
vi.mock('@/hooks/useSafePermission', () => ({ useSafePermission: () => hasPermissionRef.current }))

// Wraps the screen in a fresh QueryClient (no cache bleed / no retries slowing failures).
function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CustomerRequiredFieldsSettings /></QueryClientProvider>)
}

afterEach(() => { vi.clearAllMocks(); blobRef.current = {}; INVENTORY_REF.current = INVENTORY; hasPermissionRef.current = () => false })
INVENTORY_REF.current = INVENTORY

describe('CustomerRequiredFieldsSettings — Klant tab (phase matrix)', () => {
  it('renders one column per tenant phase, not a hardcoded pair', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Lead-fase' })).toBeInTheDocument())
    expect(screen.getByRole('columnheader', { name: 'Klant-fase' })).toBeInTheDocument()
  })

  it('toggling a cell POSTs the phase-keyed map shape, not a flat array', async () => {
    const user = userEvent.setup()
    renderScreen()
    const nameRow = await screen.findByText('Naam').then(el => el.closest('tr')!)
    // PermissionToggle renders the shared Toggle (role=switch, audit finding 05-08) —
    // was a plain <button> before that fix.
    const cells = within(nameRow).getAllByRole('switch')
    await user.click(cells[0]) // first phase column = Lead-fase
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_required_fields: JSON.stringify({ lead_fase: ['name'] }) })
  })

  it('a stored required field renders its toggle as ON (round trip)', async () => {
    blobRef.current = { customer_required_fields: { klant_fase: ['name'] } }
    renderScreen()
    // Semantic state, never the paint (same swap as ApplicationRequiredFieldsSettings.test.tsx).
    expect(await screen.findByRole('switch', { name: 'Naam — Klant-fase' })).toBeChecked()
  })

  it('a `requirable:false` inventory row renders disabled with its reason as a hover title, never hidden', async () => {
    renderScreen()
    const row = await screen.findByText('Status').then(el => el.closest('tr')!)
    expect(within(row).getAllByRole('switch')[0]).toBeDisabled()
    expect(row.querySelector('td')).toHaveAttribute('title', 'webhook-stamped')
  })

  it('a `requires_permission` row is absent without the permission, present with it', async () => {
    hasPermissionRef.current = () => false
    renderScreen()
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Lead-fase' })).toBeInTheDocument())
    // No catalogue label exists for this test-only key, so it falls back to the raw
    // key text — enough to prove presence/absence without a real translation.
    expect(screen.queryByText('salary_band')).not.toBeInTheDocument()
  })

  it('the same `requires_permission` row renders once the caller has the permission', async () => {
    hasPermissionRef.current = () => true
    renderScreen()
    expect(await screen.findByText('salary_band')).toBeInTheDocument()
  })

  // Verifier fix (17-09): a key the inventory has since turned non-requirable stays
  // stored as "required" forever otherwise (§3 no fake affordance) — every save strips it.
  it('a stale non-requirable key already in the stored map is stripped on the next save', async () => {
    const user = userEvent.setup()
    blobRef.current = { customer_required_fields: { klant_fase: ['status_id'] } }
    renderScreen()
    const nameRow = await screen.findByText('Naam').then(el => el.closest('tr')!)
    await user.click(within(nameRow).getAllByRole('switch')[1]) // second phase column = Klant-fase
    expect(postMock).toHaveBeenCalledWith('/settings', {
      customer_required_fields: JSON.stringify({ klant_fase: ['name'] }),
    })
  })
})

describe('CustomerRequiredFieldsSettings — flat sub-entity tabs', () => {
  it('Locatie tab toggling POSTs a flat array under customer_location_required_fields', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.location') }))
    await user.click(await screen.findByRole('switch', { name: 'Naam' }))
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_location_required_fields: JSON.stringify(['name']) })
  })

  it('Afdeling tab toggling POSTs a flat array under customer_department_required_fields', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.department') }))
    await user.click(await screen.findByRole('switch', { name: 'Naam' }))
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_department_required_fields: JSON.stringify(['name']) })
  })

  it('Contactpersoon tab toggling POSTs a flat array under customer_contact_required_fields', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.contact') }))
    await user.click(await screen.findByRole('switch', { name: 'Voornaam' }))
    expect(postMock).toHaveBeenCalledWith('/settings', { customer_contact_required_fields: JSON.stringify(['first_name']) })
  })

  it('a stored flat value renders its toggle as ON (round trip)', async () => {
    const user = userEvent.setup()
    blobRef.current = { customer_location_required_fields: ['name'] }
    renderScreen()
    await user.click(screen.getByRole('tab', { name: st('customerRequiredFields.tabs.location') }))
    expect(await screen.findByRole('switch', { name: 'Naam' })).toBeChecked()
  })
})
