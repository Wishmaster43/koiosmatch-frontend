/**
 * ApplicationRequiredFieldsSettings (APP-REQUIRED-FE-1, VERPLICHTE-VELDEN-INVENTARIS-1) —
 * Danny: "hoe zorg ik dat BRON bij nieuwe sollicitatie verplicht is? moet bij
 * instellingen komen."
 *
 * §13: the save assertion checks the REQUEST (route + exact flat-array body), never
 * only that a callback fired — mirrors CustomerRequiredFieldsSettings.test.tsx's own
 * flat sub-entity tab assertions, since this screen reuses the same
 * FlatRequiredFieldsToggleList building block.
 *
 * FIELDS-2-FE-3 (17-09): rows now come from the live `GET /settings/field-inventory`
 * catalogue (useFieldInventory) instead of the static APPLICATION_FIELDS array, so the
 * api.get mock below stands in for that endpoint (mirrors CustomerRequiredFieldsSettings
 * .test.tsx's own `getMock` shape).
 *
 * REQFIELDS-TOGGLE-RACE-1 regression: `loadedRef` mocks `useSettingsLoaded()`
 * independently of the blob itself, so a test can render with the GET /settings
 * fetch still "pending" (loaded=false, blob still `{}`) and assert the toggle
 * click is a no-op, then flip to loaded and assert the same click now persists
 * the correctly-merged array — proving the fix reads the STORED list, never `[]`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Side-effect import: initialises the real i18next singleton (mirrors
// CandidateRequiredFieldsSettings.test.tsx / CustomerRequiredFieldsSettings.test.tsx) —
// without it react-i18next has no default instance and every t() call renders its raw key.
import '@/i18n'
import ApplicationRequiredFieldsSettings from './ApplicationRequiredFieldsSettings'

// One field-inventory row, defaulting to a plain requirable/no-permission field.
function invField(overrides: Partial<{
  key: string; requirable: boolean; requires_permission: string | null; reason: string | null
}>) {
  return {
    key: overrides.key!, group: 'general', type: 'string',
    requirable: overrides.requirable ?? true, creatable: true, writable: true,
    internal_name: overrides.key!, external_name: overrides.key!, aliases: [],
    requires_permission: overrides.requires_permission ?? null, reason: overrides.reason ?? null,
  }
}

// The four inventory fields exercised below: the pre-existing catalogue's original
// four requirable keys, plus one `requirable:false` and one `requires_permission` row
// so both non-happy-path states are covered (mirrors CustomerRequiredFieldsSettings).
const DEFAULT_FIELDS = [
  invField({ key: 'source' }),
  invField({ key: 'vacancy_id' }),
  invField({ key: 'owner_id' }),
  invField({ key: 'application_stage_id' }),
]
const INVENTORY_REF = vi.hoisted(() => ({ current: [] as ReturnType<typeof invField>[] }))

// The blob is controlled per test; saves go through the REAL saveSettingsKeys so the
// api.post seam is asserted (mirrors CandidateRequiredFieldsSettings.test.tsx).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
// Independent "has GET /settings resolved yet" flag — defaults true so every
// existing test in this file (written before the race fix) keeps its original,
// already-loaded behaviour unchanged.
const loadedRef = vi.hoisted(() => ({ current: true }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current, useSettingsLoaded: () => loadedRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
// GET /settings/field-inventory: resolves from INVENTORY_REF, ignoring the entity param
// (this screen only ever requests 'application').
const getMock = vi.hoisted(() => vi.fn(() =>
  Promise.resolve({ data: { data: { entity: 'application', groups: [{ key: 'general', label_key: 'x' }], fields: INVENTORY_REF.current } } }),
))
vi.mock('@/lib/api', async () => {
  // Keep the real `unwrap` helper (useFieldInventory imports it as a named export) —
  // only the default axios client and the tenant-id getter are stubbed.
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: getMock, post: postMock }, getActiveTenantId: vi.fn(() => null) }
})

// A signed-in caller without the extra permission by default — the permission-gated
// inventory case flips this per test.
const hasPermissionRef = vi.hoisted(() => ({ current: (() => false) as () => boolean }))
vi.mock('@/hooks/useSafePermission', () => ({ useSafePermission: () => hasPermissionRef.current }))

// Wraps the screen in a fresh QueryClient (no cache bleed / no retries slowing failures)
// — mirrors CustomerRequiredFieldsSettings.test.tsx's own renderScreen().
function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ApplicationRequiredFieldsSettings /></QueryClientProvider>)
}

afterEach(() => {
  vi.clearAllMocks()
  blobRef.current = {}
  loadedRef.current = true
  INVENTORY_REF.current = DEFAULT_FIELDS
  hasPermissionRef.current = () => false
})
INVENTORY_REF.current = DEFAULT_FIELDS

describe('ApplicationRequiredFieldsSettings', () => {
  it('renders one toggle per inventory field, no phase axis', async () => {
    renderScreen()
    expect(await screen.findByRole('switch', { name: 'Bron' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Vacature' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Recruiter' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Fase' })).toBeInTheDocument()
    // Flat shape: no phase column headers anywhere on this screen.
    expect(screen.queryByRole('columnheader')).toBeNull()
  })

  it('toggling Bron POSTs the exact flat array under application_required_fields', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('switch', { name: 'Bron' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['source']),
    })
  })

  it('toggling a second field appends to the existing stored array, key untouched', async () => {
    const user = userEvent.setup()
    blobRef.current = { application_required_fields: ['source'] }
    renderScreen()
    await user.click(await screen.findByRole('switch', { name: 'Recruiter' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['source', 'owner_id']),
    })
  })

  it('a stored required field renders its toggle as ON (round trip)', async () => {
    blobRef.current = { application_required_fields: ['vacancy_id'] }
    renderScreen()
    // The shared Toggle exposes its state as aria-checked (§6) — asserted over
    // the semantic state, never the paint (Opus round 22-08).
    expect(await screen.findByRole('switch', { name: 'Vacature' })).toBeChecked()
  })

  it('un-toggling removes the field from the stored array instead of leaving a stale entry', async () => {
    const user = userEvent.setup()
    blobRef.current = { application_required_fields: ['source', 'owner_id'] }
    renderScreen()
    await user.click(await screen.findByRole('switch', { name: 'Bron' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['owner_id']),
    })
  })

  it('with the setting absent, every toggle starts OFF (nothing extra required)', async () => {
    renderScreen()
    for (const name of ['Bron', 'Vacature', 'Recruiter', 'Fase']) {
      expect(await screen.findByRole('switch', { name })).not.toBeChecked()
    }
  })

  // REQFIELDS-TOGGLE-RACE-1: the fetch has not resolved yet, so the blob is still
  // the pre-load `{}`. A click here must NOT build `next` from that empty fallback
  // and must NOT reach the network at all — the toggle is disabled and inert.
  it('while settings are still loading, a click fires no POST and the toggle is disabled', async () => {
    const user = userEvent.setup()
    loadedRef.current = false
    blobRef.current = {} // pending fetch: not yet the tenant's real stored blob
    renderScreen()
    const toggle = await screen.findByRole('switch', { name: 'Bron' })
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(postMock).not.toHaveBeenCalled()
  })

  // Same click, now that the fetch has resolved with the tenant's real stored
  // array: the toggle re-enables and the POST merges from the STORED list, never `[]`.
  it('once loaded, the same field toggles and POSTs merged from the stored list, not []', async () => {
    const user = userEvent.setup()
    loadedRef.current = true
    blobRef.current = { application_required_fields: ['owner_id'] }
    renderScreen()
    const toggle = await screen.findByRole('switch', { name: 'Bron' })
    expect(toggle).not.toBeDisabled()
    await user.click(toggle)
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['owner_id', 'source']),
    })
  })

  // VERPLICHTE-VELDEN-INVENTARIS-1: a non-requirable row (custom_fields — its own
  // required/required_phases mechanism lives on the field definition) renders
  // disabled with its reason as a hover title, never hidden (Danny wants to SEE
  // what he can't require and why).
  it('a `requirable:false` inventory row renders disabled with its reason, never hidden', async () => {
    INVENTORY_REF.current = [
      ...DEFAULT_FIELDS,
      invField({ key: 'custom_fields', requirable: false, reason: 'custom fields carry their own required/required_phases mechanism on the field definition' }),
    ]
    renderScreen()
    const toggle = await screen.findByRole('switch', { name: 'Eigen velden' })
    expect(toggle).toBeDisabled()
    expect(screen.getByText('Eigen velden')).toHaveAttribute(
      'title',
      'Eigen velden hebben hun eigen verplichtingsinstelling op de velddefinitie zelf.',
    )
  })

  // A `requires_permission` row is hidden entirely without the permission, and
  // renders once the caller has it (mirrors CustomerRequiredFieldsSettings).
  it('a `requires_permission` row is absent without the permission, present with it', async () => {
    INVENTORY_REF.current = [...DEFAULT_FIELDS, invField({ key: 'match_score', requires_permission: 'applications.financial.view' })]
    hasPermissionRef.current = () => false
    renderScreen()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Bron' })).toBeInTheDocument())
    // Query the resolved LABEL, not the raw key — the raw key never renders in
    // either branch, so asserting it would pass even without the permission filter.
    expect(screen.queryByRole('switch', { name: 'Matchscore' })).toBeNull()
  })

  it('the same `requires_permission` row renders once the caller has the permission', async () => {
    INVENTORY_REF.current = [...DEFAULT_FIELDS, invField({ key: 'match_score', requires_permission: 'applications.financial.view' })]
    hasPermissionRef.current = () => true
    renderScreen()
    expect(await screen.findByText('Matchscore')).toBeInTheDocument()
  })

  // VERPLICHTE-VELDEN-INVENTARIS-1 verifier fix: `phase_key` is published by the
  // inventory (no DB column, requirable:false) and must never render its raw key.
  it('the `phase_key` inventory row renders its translated label, never the raw key', async () => {
    INVENTORY_REF.current = [
      ...DEFAULT_FIELDS,
      invField({ key: 'phase_key', requirable: false, reason: 'no such column on the applications table' }),
    ]
    renderScreen()
    expect(await screen.findByText('Fase (systeem)')).toBeInTheDocument()
    expect(screen.queryByText('phase_key')).not.toBeInTheDocument()
  })

  it('renders an error banner with retry when the field inventory fails to load', async () => {
    getMock.mockRejectedValueOnce(new Error('network'))
    renderScreen()
    expect(await screen.findByText(/failed|mislukt/i)).toBeInTheDocument()
  })
})
