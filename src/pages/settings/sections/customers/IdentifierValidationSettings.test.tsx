/**
 * IdentifierValidationSettings (KVK/BTW-PER-LAND-1, Danny 08-08 points 10 + 11) —
 * the tenant switch that decides whether a KvK/BTW number that does not match its
 * country's format BLOCKS the save or only warns.
 *
 * §13: the save assertion checks the REQUEST (POST /settings body + key), never
 * only that a callback fired — the setting is worthless if the key never lands.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IdentifierValidationSettings from './IdentifierValidationSettings'

// The blob is controlled per test; saves run through the REAL saveSettingsKeys so
// the api.post seam is asserted (mirrors CustomerRequiredFieldsSettings.test.tsx).
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
// Typed args (not a bare `() =>`) so the request assertions below can read them.
const postMock = vi.hoisted(() => vi.fn((...args: [string, unknown]) => { void args; return Promise.resolve({ data: {} }) }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))
// t() echoes the key so assertions read as the contract, not as Dutch copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
}))

beforeEach(() => { blobRef.current = {}; postMock.mockClear() })

describe('IdentifierValidationSettings', () => {
  it('shows the warn mode when the tenant never chose one', () => {
    render(<IdentifierValidationSettings />)
    expect(screen.getByLabelText('identifierValidation.modeLabel')).toHaveTextContent('identifierValidation.modeWarn')
  })

  it('shows the stored block mode', () => {
    blobRef.current = { company_identifier_validation: 'block' }
    render(<IdentifierValidationSettings />)
    expect(screen.getByLabelText('identifierValidation.modeLabel')).toHaveTextContent('identifierValidation.modeBlock')
  })

  it('persists the chosen mode under the generic settings key', async () => {
    const user = userEvent.setup()
    render(<IdentifierValidationSettings />)
    await user.click(screen.getByLabelText('identifierValidation.modeLabel'))
    await user.click(screen.getByText('identifierValidation.modeBlock'))

    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0][0]).toBe('/settings')
    expect(postMock.mock.calls[0][1]).toEqual({ company_identifier_validation: 'block' })
  })

  it('lists the real per-country formats, so "8 digits" is visibly Dutch-only', () => {
    render(<IdentifierValidationSettings />)
    // The examples are the module's own data — NL 8 digits, BE 10, DE HRB, FR SIREN.
    expect(screen.getByText('12345678')).toBeInTheDocument()
    expect(screen.getByText('0123456789')).toBeInTheDocument()
    expect(screen.getByText('HRB 12345')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByText('NL123456789B01')).toBeInTheDocument()
    expect(screen.getByText('BE0123456789')).toBeInTheDocument()
    expect(screen.getByText('DE123456789')).toBeInTheDocument()
    expect(screen.getByText('FR12123456789')).toBeInTheDocument()
  })
})
