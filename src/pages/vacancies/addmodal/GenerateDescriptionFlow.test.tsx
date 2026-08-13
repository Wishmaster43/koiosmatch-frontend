/**
 * GenerateDescriptionFlow — punt 17 UI states. The hook is mocked (mirrors
 * VacancyGenerateFlow.test.tsx's convention) so each state is driven
 * deterministically. Proves: (1) the entry button is disabled-with-an-honest-
 * title until a job title exists (no base_vacancy_id to fall back on); (2)
 * "Toepassen" is the ONLY path that calls onApply — a successful generate must
 * never auto-apply the concept (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import GenerateDescriptionFlow from './GenerateDescriptionFlow'
import nl from '@/i18n/locales/nl/vacancies.json'
import nlCommon from '@/i18n/locales/nl/common.json'
import type { GenerateFormFields } from './useGenerateDescription'

const openFlow = vi.fn()
const closeFlow = vi.fn()
const generate = vi.fn()
const discard = vi.fn()

let mockState: Record<string, unknown> = {}
vi.mock('./useGenerateDescription', () => ({ useGenerateDescription: () => mockState }))

const emptyFields: GenerateFormFields = { title: '', category: '', industry: '', contractTypes: [], city: '', hoursMin: '', hoursMax: '', customerName: '' }
const filledFields: GenerateFormFields = { ...emptyFields, title: 'Verpleegkundige' }

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { open: false, openFlow, closeFlow, profile: null, resolving: false, resolveFailed: false, noProfileConfigured: false, status: 'idle', concept: '', generate, discard }
})

describe('GenerateDescriptionFlow · disabled until ready', () => {
  it('disables the entry button with an honest title when there is no job title yet', async () => {
    render(<GenerateDescriptionFlow fields={emptyFields} onApply={vi.fn()} />)
    const btn = screen.getByRole('button', { name: nl.generate.button })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', nl.generate.needsTitleFirst)
    await userEvent.click(btn)
    expect(openFlow).not.toHaveBeenCalled()
  })

  it('enables the entry button once a title is filled', async () => {
    render(<GenerateDescriptionFlow fields={filledFields} onApply={vi.fn()} />)
    const btn = screen.getByRole('button', { name: nl.generate.button })
    expect(btn).not.toBeDisabled()
    await userEvent.click(btn)
    expect(openFlow).toHaveBeenCalledTimes(1)
  })
})

describe('GenerateDescriptionFlow · open, resolving', () => {
  it('shows the resolving hint and keeps Generate disabled', () => {
    mockState = { ...mockState, open: true, resolving: true }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.resolving)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: nl.generate.cta })).toBeDisabled()
  })
})

describe('GenerateDescriptionFlow · no profile configured', () => {
  it('shows the calm notice with no dead Generate button', () => {
    mockState = { ...mockState, open: true, noProfileConfigured: true }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.noProfile)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: nl.generate.cta })).toBeNull()
  })
})

describe('GenerateDescriptionFlow · 503 soft-fail', () => {
  it('shows a calm "unavailable" message (never the credit wording) with a retry that re-calls generate()', async () => {
    mockState = { ...mockState, open: true, status: 'unavailable' }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={vi.fn()} />)
    expect(screen.getByText(nlCommon.errors.koiosUnavailable)).toBeInTheDocument()
    expect(screen.queryByText(nlCommon.errors.koiosCreditExhausted)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: nlCommon.error.retry }))
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

describe('GenerateDescriptionFlow · 402 credit exhausted', () => {
  it('shows the calm credit-exhausted notice and keeps the retry button enabled', async () => {
    mockState = { ...mockState, open: true, status: 'creditExhausted', errorKey: 'errors.koiosCreditExhausted' }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={vi.fn()} />)
    expect(screen.getByText(nlCommon.errors.koiosCreditExhausted)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: nlCommon.error.retry })
    expect(retryBtn).not.toBeDisabled()
    await userEvent.click(retryBtn)
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

describe('GenerateDescriptionFlow · 404 no profile resolved mid-flow', () => {
  it('shows the calm notice (not an error)', () => {
    mockState = { ...mockState, open: true, status: 'noProfile' }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={vi.fn()} />)
    expect(screen.getByText(nl.generate.noProfile)).toBeInTheDocument()
  })
})

describe('GenerateDescriptionFlow · success — review before apply', () => {
  it('shows the concept as a proposal and does NOT call onApply until Toepassen is clicked', async () => {
    const onApply = vi.fn()
    mockState = { ...mockState, open: true, status: 'success', concept: 'Wij zoeken een verpleegkundige…' }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={onApply} />)

    expect(screen.getByText('Wij zoeken een verpleegkundige…')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
    // AI-ACT-1: the generated concept carries the shared AI-generated disclosure
    // label (common:aiGenerated has no entry yet, so it falls back to its Dutch
    // defaultValue — see AiGeneratedLabel).
    expect(screen.getByText('AI-gegenereerd')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: nl.generate.apply }))
    expect(onApply).toHaveBeenCalledWith('Wij zoeken een verpleegkundige…')
    expect(closeFlow).toHaveBeenCalledTimes(1)
  })

  it('Verwerpen discards the concept without ever calling onApply', async () => {
    const onApply = vi.fn()
    mockState = { ...mockState, open: true, status: 'success', concept: 'Concept X' }
    render(<GenerateDescriptionFlow fields={filledFields} onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: nl.generate.discard }))
    expect(discard).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })
})
