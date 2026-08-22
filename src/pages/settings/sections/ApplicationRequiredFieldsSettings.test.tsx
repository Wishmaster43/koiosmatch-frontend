/**
 * ApplicationRequiredFieldsSettings (APP-REQUIRED-FE-1) — Danny: "hoe zorg ik dat
 * BRON bij nieuwe sollicitatie verplicht is? moet bij instellingen komen."
 *
 * §13: the save assertion checks the REQUEST (route + exact flat-array body), never
 * only that a callback fired — mirrors CustomerRequiredFieldsSettings.test.tsx's own
 * flat sub-entity tab assertions, since this screen reuses the same
 * FlatRequiredFieldsToggleList building block.
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
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

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
})
