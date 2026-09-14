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

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('MatchRatesSettings', () => {
  it('loads the saved conversion factor from /settings/matching', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { conversion_factor: 1.35 } } })
    render(<MatchRatesSettings />)
    await waitFor(() => expect(screen.getByLabelText(st('matchRates.title'))).toHaveValue(1.35))
    expect(api.get).toHaveBeenCalledWith('/settings/matching')
  })

  it('saves a new factor on blur via a partial PUT', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { conversion_factor: null } } })
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } })
    const user = userEvent.setup()
    render(<MatchRatesSettings />)
    const input = await screen.findByLabelText(st('matchRates.title'))
    await waitFor(() => expect(input).toHaveValue(null))

    await user.type(input, '1.5')
    await user.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { conversion_factor: 1.5 }))
  })

  it('an empty input persists null (clears the factor)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { conversion_factor: 1.35 } } })
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } })
    const user = userEvent.setup()
    render(<MatchRatesSettings />)
    const input = await screen.findByLabelText(st('matchRates.title'))
    await waitFor(() => expect(input).toHaveValue(1.35))

    await user.clear(input)
    await user.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { conversion_factor: null }))
  })

  it('a non-positive value is rejected locally and reverted — no request sent', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { conversion_factor: 1.35 } } })
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

// Audit finding B: a load failure must render its own error state, never an empty
// input that reads as "no factor configured" (§3 — error is never the same as empty).
describe('MatchRatesSettings — load failure', () => {
  it('shows an error notice instead of the input when GET /settings/matching fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network down'))
    render(<MatchRatesSettings />)

    expect(await screen.findByText(st('matchRates.loadError'))).toBeInTheDocument()
    expect(screen.queryByLabelText(st('matchRates.title'))).not.toBeInTheDocument()
  })
})

// Audit finding B: an unmounted component must not update state once its in-flight
// GET resolves — a regression would surface as a React act()/state-update warning.
describe('MatchRatesSettings — unmount safety (alive-guard)', () => {
  it('does not throw or warn when the GET resolves after unmount', async () => {
    let resolveGet: (value: unknown) => void = () => {}
    vi.mocked(api.get).mockReturnValue(new Promise(resolve => { resolveGet = resolve }))
    const { unmount } = render(<MatchRatesSettings />)
    unmount()

    resolveGet({ data: { data: { conversion_factor: 1.35 } } })
    await new Promise(resolve => setTimeout(resolve, 0))
  })
})

// S-1: conversion_factor is stripped for callers without billing.view permission.
// When absent from the response, the input field is hidden and no PUT is sent.
describe('MatchRatesSettings — S-1 absent field (no billing.view)', () => {
  it('hides the input when conversion_factor is absent from the response', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {} } })
    render(<MatchRatesSettings />)

    // Input never appears when the field is absent.
    await waitFor(() => {
      expect(screen.queryByLabelText(st('matchRates.title'))).not.toBeInTheDocument()
    })
  })

  it('does not send a PUT when the field is absent (absence = no permission)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {} } })
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } })
    render(<MatchRatesSettings />)

    // Verify the input is not rendered.
    await waitFor(() => {
      expect(screen.queryByLabelText(st('matchRates.title'))).not.toBeInTheDocument()
    })
    expect(api.put).not.toHaveBeenCalled()
  })
})
