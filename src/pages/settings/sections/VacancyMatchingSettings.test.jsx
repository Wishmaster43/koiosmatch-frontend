/**
 * VacancyMatchingSettings — Danny 22-07: the global matching-strictness slider now
 * shows a concrete number + % alongside the word label (position on the 3-step
 * scale), and the screen no longer renders the purchase→sale conversion factor
 * (moved to Settings → Matches → MatchRatesSettings, its own block).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import VacancyMatchingSettings from './VacancyMatchingSettings'

// Keep the real unwrap (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('VacancyMatchingSettings', () => {
  it('shows the concrete level number + % alongside the word label for the loaded strictness', async () => {
    api.get.mockResolvedValue({ data: { data: { strictness: 'balanced', approval_mode: 'bij_afwijking' } } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.balanced'))).toBeInTheDocument())
    // balanced = index 1 of 3 levels → "2/3 · 50%".
    expect(screen.getByText('2/3 · 50%')).toBeInTheDocument()
  })

  it('updates the number + % readout when a different strictness level is picked', async () => {
    api.get.mockResolvedValue({ data: { data: { strictness: 'lenient', approval_mode: 'bij_afwijking' } } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('1/3 · 0%')).toBeInTheDocument())

    // Drive the slider via its own keyboard support (arrow keys nudge by one step).
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByText('2/3 · 50%')).toBeInTheDocument()
  })

  it('no longer renders the purchase→sale conversion factor input (moved to MatchRatesSettings)', async () => {
    api.get.mockResolvedValue({ data: { data: { strictness: 'balanced' } } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.title'))).toBeInTheDocument())
    // The conversion-factor number input was the only <input type="number"> here.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})
