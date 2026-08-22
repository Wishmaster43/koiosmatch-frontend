/**
 * ApplicationRequiredFieldsSettings (APP-REQUIRED-FE-1) — Danny: "hoe zorg ik dat
 * BRON bij nieuwe sollicitatie verplicht is? moet bij instellingen komen."
 *
 * §13: the save assertion checks the REQUEST (route + exact flat-array body), never
 * only that a callback fired — mirrors CustomerRequiredFieldsSettings.test.tsx's own
 * flat sub-entity tab assertions, since this screen reuses the same
 * FlatRequiredFieldsToggleList building block.
 *
 * REQFIELDS-TOGGLE-RACE-1 regression: `loadedRef` mocks `useSettingsLoaded()`
 * independently of the blob itself, so a test can render with the GET /settings
 * fetch still "pending" (loaded=false, blob still `{}`) and assert the toggle
 * click is a no-op, then flip to loaded and assert the same click now persists
 * the correctly-merged array — proving the fix reads the STORED list, never `[]`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import: initialises the real i18next singleton (mirrors
// CandidateRequiredFieldsSettings.test.tsx / CustomerRequiredFieldsSettings.test.tsx) —
// without it react-i18next has no default instance and every t() call renders its raw key.
import '@/i18n'
import ApplicationRequiredFieldsSettings from './ApplicationRequiredFieldsSettings'

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
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {}; loadedRef.current = true })

describe('ApplicationRequiredFieldsSettings', () => {
  it('renders one toggle per catalog field, no phase axis', () => {
    render(<ApplicationRequiredFieldsSettings />)
    expect(screen.getByRole('switch', { name: 'Bron' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Vacature' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Recruiter' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Fase' })).toBeInTheDocument()
    // Flat shape: no phase column headers anywhere on this screen.
    expect(screen.queryByRole('columnheader')).toBeNull()
  })

  it('toggling Bron POSTs the exact flat array under application_required_fields', async () => {
    const user = userEvent.setup()
    render(<ApplicationRequiredFieldsSettings />)
    await user.click(screen.getByRole('switch', { name: 'Bron' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['source']),
    })
  })

  it('toggling a second field appends to the existing stored array, key untouched', async () => {
    const user = userEvent.setup()
    blobRef.current = { application_required_fields: ['source'] }
    render(<ApplicationRequiredFieldsSettings />)
    await user.click(screen.getByRole('switch', { name: 'Recruiter' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['source', 'owner_id']),
    })
  })

  it('a stored required field renders its toggle as ON (round trip)', () => {
    blobRef.current = { application_required_fields: ['vacancy_id'] }
    render(<ApplicationRequiredFieldsSettings />)
    // The shared Toggle exposes its state as aria-checked (§6) — asserted over
    // the semantic state, never the paint (Opus round 22-08).
    expect(screen.getByRole('switch', { name: 'Vacature' })).toBeChecked()
  })

  it('un-toggling removes the field from the stored array instead of leaving a stale entry', async () => {
    const user = userEvent.setup()
    blobRef.current = { application_required_fields: ['source', 'owner_id'] }
    render(<ApplicationRequiredFieldsSettings />)
    await user.click(screen.getByRole('switch', { name: 'Bron' }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['owner_id']),
    })
  })

  it('with the setting absent, every toggle starts OFF (nothing extra required)', () => {
    render(<ApplicationRequiredFieldsSettings />)
    for (const name of ['Bron', 'Vacature', 'Recruiter', 'Fase']) {
      expect(screen.getByRole('switch', { name })).not.toBeChecked()
    }
  })

  // REQFIELDS-TOGGLE-RACE-1: the fetch has not resolved yet, so the blob is still
  // the pre-load `{}`. A click here must NOT build `next` from that empty fallback
  // and must NOT reach the network at all — the toggle is disabled and inert.
  it('while settings are still loading, a click fires no POST and the toggle is disabled', async () => {
    const user = userEvent.setup()
    loadedRef.current = false
    blobRef.current = {} // pending fetch: not yet the tenant's real stored blob
    render(<ApplicationRequiredFieldsSettings />)
    const toggle = screen.getByRole('switch', { name: 'Bron' })
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
    render(<ApplicationRequiredFieldsSettings />)
    const toggle = screen.getByRole('switch', { name: 'Bron' })
    expect(toggle).not.toBeDisabled()
    await user.click(toggle)
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_required_fields: JSON.stringify(['owner_id', 'source']),
    })
  })
})
