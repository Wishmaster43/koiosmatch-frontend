/**
 * CareerSiteSettings — the toggle moved to its OWN sub-tab (Danny 23-07).
 * §13: the save assertion checks the REQUEST (settings POST body), not a callback.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CareerSiteSettings from './CareerSiteSettings'

// Route the shared settings loader: the blob is controlled per test; saves go
// through the REAL saveSettingsKeys so the api.post seam is asserted.
const blobRef = vi.hoisted(() => ({ current: {} }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})), post: postMock } }))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

describe('CareerSiteSettings', () => {
  it('renders unchecked when the setting is absent', () => {
    render(<CareerSiteSettings />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it.each([[true], [1], ['1'], ['true']])('coerces stored truthy form %p to checked', (v) => {
    blobRef.current = { career_site_active: v }
    render(<CareerSiteSettings />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('toggling POSTs the settings key immediately (stringified boolean)', async () => {
    const user = userEvent.setup()
    render(<CareerSiteSettings />)
    await user.click(screen.getByRole('checkbox'))
    expect(postMock).toHaveBeenCalledWith('/settings', { career_site_active: 'true' })
  })
})
