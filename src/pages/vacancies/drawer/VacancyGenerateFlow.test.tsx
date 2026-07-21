/**
 * VacancyGenerateFlow — VACGEN-1 fase 1b UI states. The hook is mocked (mirrors
 * MatchingTab.test.tsx's convention for a react-query-backed hook) so each state
 * is driven deterministically. §13: proves "Toepassen" is the ONLY path that
 * calls onApply — a successful generate must never auto-apply the concept.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import — initializes the real i18next instance with the actual
// locale JSONs (this component doesn't transitively pull it in like tabs that
// use useDateFormat do), so `t()` resolves real strings instead of raw keys.
import '@/i18n'
import VacancyGenerateFlow from './VacancyGenerateFlow'
import { mapVacancyDetail } from '../data/mapVacancy'
import nl from '@/i18n/locales/nl/vacancies.json'
import nlCommon from '@/i18n/locales/nl/common.json'

const openFlow = vi.fn()
const closeFlow = vi.fn()
const generate = vi.fn()
const discard = vi.fn()

// Mutable mock state — each test sets what the hook "returns" before rendering.
let mockState: Record<string, unknown> = {}
vi.mock('../hooks/useVacancyGenerate', () => ({ useVacancyGenerate: () => mockState }))

const vacancy = mapVacancyDetail({ id: 'v1', title: 'Test' })

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { open: false, openFlow, closeFlow, profile: null, resolving: false, resolveFailed: false, noProfileConfigured: false, status: 'idle', concept: '', generate, discard }
})

describe('VacancyGenerateFlow · closed', () => {
  it('shows only the entry button, which opens the flow', async () => {
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={vi.fn()} />)
    const btn = screen.getByRole('button', { name: nl.generate.button })
    await userEvent.click(btn)
    expect(openFlow).toHaveBeenCalledTimes(1)
  })
})

describe('VacancyGenerateFlow · open, resolving', () => {
  it('shows the resolving hint and keeps Generate disabled', () => {
    mockState = { ...mockState, open: true, resolving: true }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.resolving)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: nl.generate.cta })).toBeDisabled()
  })
})

describe('VacancyGenerateFlow · profile resolved, idle', () => {
  it('shows the read-only transparency chip and Generate calls generate()', async () => {
    mockState = { ...mockState, open: true, profile: { profileId: 'p1', name: 'Zorg', specificity: 2, matchedDims: [] } }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={vi.fn()} />)
    expect(screen.getByText('Profiel: Zorg · specificiteit 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: nl.generate.cta }))
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

describe('VacancyGenerateFlow · no profile configured', () => {
  it('shows the calm notice with no dead Generate button', () => {
    mockState = { ...mockState, open: true, noProfileConfigured: true }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.noProfile)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: nl.generate.cta })).toBeNull()
  })
})

describe('VacancyGenerateFlow · loading', () => {
  it('shows the generating status (aria-live)', () => {
    mockState = { ...mockState, open: true, status: 'loading' }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.generating)).toBeInTheDocument()
  })
})

describe('VacancyGenerateFlow · 503 soft-fail', () => {
  it('shows a calm "unavailable" message (never a crash) with a retry that re-calls generate()', async () => {
    mockState = { ...mockState, open: true, status: 'unavailable' }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.unavailable)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: nlCommon.error.retry }))
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

describe('VacancyGenerateFlow · success — review before apply', () => {
  it('shows the concept as a proposal and does NOT call onApply until the user clicks Toepassen', async () => {
    const onApply = vi.fn()
    mockState = { ...mockState, open: true, status: 'success', concept: 'Wij zoeken een verpleegkundige…' }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={onApply} />)

    expect(screen.getByText('Wij zoeken een verpleegkundige…')).toBeInTheDocument()
    // No auto-apply just because a concept is present.
    expect(onApply).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: nl.generate.apply }))
    expect(onApply).toHaveBeenCalledWith('Wij zoeken een verpleegkundige…')
    expect(closeFlow).toHaveBeenCalledTimes(1)
  })

  it('Verwerpen discards the concept without ever calling onApply', async () => {
    const onApply = vi.fn()
    mockState = { ...mockState, open: true, status: 'success', concept: 'Concept X' }
    render(<VacancyGenerateFlow vacancy={vacancy} onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: nl.generate.discard }))
    expect(discard).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })
})
