/**
 * MatchRatesSettings — Danny 22-07: the purchase→sale conversion factor moved here
 * (Settings → Matches) from Vacancies → Matching, as its own block. Covers load,
 * save-on-blur (partial PUT to the shared /settings/matching resource), the empty
 * input clearing the factor, and a locally-rejected invalid value never firing a request.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import MatchRatesSettings from './MatchRatesSettings'

// Keep the real unwrap (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('MatchRatesSettings', () => {
  it('loads the saved conversion factor from /settings/matching', async () => {
    api.get.mockResolvedValue({ data: { data: { conversion_factor: 1.35 } } })
    render(<MatchRatesSettings />)
    await waitFor(() => expect(screen.getByLabelText(st('matchRates.title'))).toHaveValue(1.35))
    expect(api.get).toHaveBeenCalledWith('/settings/matching')
  })

  it('saves a new factor on blur via a partial PUT', async () => {
    api.get.mockResolvedValue({ data: { data: { conversion_factor: null } } })
    api.put.mockResolvedValue({ data: { data: {} } })
    const user = userEvent.setup()
    render(<MatchRatesSettings />)
    const input = await screen.findByLabelText(st('matchRates.title'))
    await waitFor(() => expect(input).toHaveValue(null))

    await user.type(input, '1.5')
    await user.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { conversion_factor: 1.5 }))
  })

  it('an empty input persists null (clears the factor)', async () => {
    api.get.mockResolvedValue({ data: { data: { conversion_factor: 1.35 } } })
    api.put.mockResolvedValue({ data: { data: {} } })
    const user = userEvent.setup()
    render(<MatchRatesSettings />)
    const input = await screen.findByLabelText(st('matchRates.title'))
    await waitFor(() => expect(input).toHaveValue(1.35))

    await user.clear(input)
    await user.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { conversion_factor: null }))
  })

  it('a non-positive value is rejected locally and reverted — no request sent', async () => {
    api.get.mockResolvedValue({ data: { data: { conversion_factor: 1.35 } } })
    const user = userEvent.setup()
    render(<MatchRatesSettings />)
    const input = await screen.findByLabelText(st('matchRates.title'))
    await waitFor(() => expect(input).toHaveValue(1.35))

    await user.clear(input)
    await user.type(input, '-2')
    await user.tab()

    await waitFor(() => expect(input).toHaveValue(1.35))
    expect(api.put).not.toHaveBeenCalled()
  })
})
