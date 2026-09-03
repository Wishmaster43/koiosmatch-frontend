import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosAdviceBlock from './KoiosAdviceBlock'

// Mock react-i18next to control translation output in tests
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        // For the adviceAskTemplate, substitute the {{advice}} placeholder
        if (key === 'common:koios.adviceAskTemplate' && opts?.advice) {
          return `Wij adviseren: ${opts.advice}. Waarmee kan ik je helpen, welke actie(s) kan ik ondernemen?`
        }
        // Specific keys return their known values
        if (key === 'common:aiGeneratedHint' && opts?.defaultValue) {
          return opts.defaultValue as string
        }
        // For other keys, return the key as-is (matching the existing test pattern)
        return key
      },
      i18n: { language: 'nl' },
    }),
  }
})

// Shared fixture: two collapsed insight rows, mirroring a typical entity's advice.
const insights = [
  { type: 'Completeness', color: 'var(--color-warning-text)', text: 'Profile is 40% complete.' },
  { type: 'Engagement', color: 'var(--color-secondary)', text: 'No recent contact recorded.' },
]

describe('KoiosAdviceBlock', () => {
  it('renders the heading and keeps insight text collapsed by default', () => {
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)
    // AI-ACT-1: the mark now carries the AI-Act disclosure hint as its title
    // (defaultValue fallback, §5) instead of the generic "Koios AI" default —
    // the heading text already names "Koios AI adviseert" (ai.title), so the
    // mark's tooltip is the one place left to add without a double badge.
    expect(screen.getByTitle('Door Koios AI gegenereerd — controleer voor gebruik.')).toBeInTheDocument()
    expect(screen.getByText('Completeness')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
    expect(screen.queryByText('Profile is 40% complete.')).toBeNull()
  })

  it('reveals an insight on click and collapses it again on a second click', async () => {
    const user = userEvent.setup()
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)
    await user.click(screen.getByText('Completeness'))
    expect(screen.getByText('Profile is 40% complete.')).toBeInTheDocument()
    await user.click(screen.getByText('Completeness'))
    expect(screen.queryByText('Profile is 40% complete.')).toBeNull()
  })

  it('awaits the onRefresh callback and shows the analysing copy while it runs', async () => {
    const user = userEvent.setup()
    let resolveRefresh: () => void = () => {}
    const onRefresh = vi.fn(() => new Promise<void>(resolve => { resolveRefresh = resolve }))
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} onRefresh={onRefresh} />)

    await user.click(screen.getByRole('button', { name: 'ai.refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText('ai.analyzing')).toBeInTheDocument()

    resolveRefresh()
    await waitFor(() => expect(screen.queryByText('ai.analyzing')).toBeNull())
    expect(screen.getByText('Completeness')).toBeInTheDocument()
  })

  // Audit 2026-07-28 (§6 icon-only buttons): the refresh button only had a `title`
  // attribute, no `aria-label` — a weaker, less consistently exposed accessible name
  // than every other icon-only control in this area. A role+name query only succeeds
  // once a real accessible name (aria-label) is present.
  it('exposes an accessible name on the icon-only refresh button when a real callback exists', () => {
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} onRefresh={() => {}} />)
    expect(screen.getByRole('button', { name: 'ai.refresh' })).toBeInTheDocument()
  })

  // §3 no fake affordances: without a real onRefresh there is nothing to call,
  // so the refresh button must not render at all (it used to fake a 1.4s delay).
  it('renders no refresh button without a real onRefresh callback', () => {
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)
    expect(screen.queryByRole('button', { name: 'ai.refresh' })).not.toBeInTheDocument()
  })

  // KOIOS-ADVIES-DOORKLIK-1: the revealed advice line carries a button that
  // dispatches the shared window event opening the Koios panel with a composed
  // question that includes the advice text — never a direct AI/network call (API-CREDITS-1).
  it('dispatches the ask-Koios bridge event with the advice sentence when the ask-button is clicked', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    window.addEventListener('km:ask-koios', onAsk)
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)

    // Open the first insight
    await user.click(screen.getByText('Completeness'))
    // Click the "Finish in the chat" button that appears
    const askButton = screen.getByRole('button', { name: 'common:koios.assistant.askKoios' })
    await user.click(askButton)

    expect(onAsk).toHaveBeenCalledTimes(1)
    const detail = (onAsk.mock.calls[0][0] as CustomEvent<{ text: string }>).detail
    // The dispatched text includes the advice interpolated into the template
    expect(detail.text).toContain('Wij adviseren: Profile is 40% complete.')
    expect(detail.text).toContain('Waarmee kan ik je helpen')

    window.removeEventListener('km:ask-koios', onAsk)
  })
})
