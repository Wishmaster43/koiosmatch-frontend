/**
 * RetentionSettings (AVG-RET-2, Danny 22-07 punt 8; consent row added 13-08
 * per CMBE handoff) — asserts the REAL /settings request (§13: a mutation/read
 * test must prove the seam, never only that a callback fired): the three
 * retention windows load with tenant defaults, coerce stored strings to
 * numbers, and save all three keys on a single POST. The legacy
 * `retention_candidate_months` key is never rendered as a field.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RetentionSettings from './RetentionSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: {} })
})

describe('RetentionSettings — load', () => {
  it('GETs /settings and renders the tenant defaults (24 / 60 / 24 months)', async () => {
    render(<RetentionSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findAllByDisplayValue('24')).toHaveLength(2) // never-placed + consent-months share the 24 default
    expect(screen.getByDisplayValue('60')).toBeInTheDocument()
  })

  it('coerces stored string values to numbers', async () => {
    api.get.mockResolvedValue({ data: { retention_months_never_placed: '36', retention_months_ever_placed: '84', retention_consent_months: '12' } })
    render(<RetentionSettings />)
    expect(await screen.findByDisplayValue('36')).toBeInTheDocument()
    expect(screen.getByDisplayValue('84')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()
  })

  it('never renders the legacy retention_candidate_months key as a field', async () => {
    render(<RetentionSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(screen.queryByText(/retention_candidate_months/i)).not.toBeInTheDocument()
  })
})

describe('RetentionSettings — save', () => {
  it('POSTs all three retention keys to /settings on save', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const neverPlaced = (await screen.findAllByDisplayValue('24'))[0]

    await user.clear(neverPlaced)
    await user.type(neverPlaced, '36')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      retention_months_never_placed: '36', retention_months_ever_placed: '60', retention_consent_months: '24',
    }))
  })

  it('allows 0 for consent months (deliberate "never expires") and saves it verbatim', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const rows = await screen.findAllByDisplayValue('24')
    const consentField = rows[rows.length - 1]

    await user.clear(consentField)
    await user.type(consentField, '0')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      retention_months_never_placed: '24', retention_months_ever_placed: '60', retention_consent_months: '0',
    }))
  })
})

// Audit finding A: a failed GET /settings must never render as "policy = defaults"
// (AVG-sensitive retention windows) — the shared SettingsScaffold shows an error
// notice and blocks Save until a reload succeeds.
describe('RetentionSettings — load failure (AVG: never save over an unknown policy)', () => {
  it('renders the error notice and disables Save when GET /settings fails', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<RetentionSettings />)

    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
    // The hardcoded defaults never render as if they were the confirmed tenant policy.
    expect(screen.queryByDisplayValue('24')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
  })
})
