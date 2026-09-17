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
    expect(screen.getByTitle('Door Koios AI gegenereerd. Controleer voor gebruik.')).toBeInTheDocument()
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

// S1 K-266/K-267: the new `aiAdvice` prop — a REAL AI advice cache, distinct
// from the deterministic `insights` above. `@/lib/api`/AI calls are never
// exercised here — this suite only renders the prop the hook already resolved.
describe('KoiosAdviceBlock · aiAdvice (S1 K-266/K-267)', () => {
  it('renders nothing extra when the host does not carry the field at all', () => {
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)
    expect(screen.queryByText('common:koios.advice.none')).toBeNull()
    expect(screen.queryByRole('button', { name: 'common:koios.advice.refresh' })).not.toBeInTheDocument()
  })

  it('renders the empty state + refresh button when aiAdvice is null and onRequestAdvice is passed', async () => {
    const onRequestAdvice = vi.fn()
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} aiAdvice={null} onRequestAdvice={onRequestAdvice} />)
    expect(screen.getByText('common:koios.advice.none')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'common:koios.advice.refresh' })
    await userEvent.click(btn)
    expect(onRequestAdvice).toHaveBeenCalledTimes(1)
  })

  it('renders no refresh button when onRequestAdvice is absent, even with aiAdvice present', () => {
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} aiAdvice={{ verdict: 'proceed', score: 80 }} />)
    expect(screen.queryByRole('button', { name: 'common:koios.advice.refresh' })).not.toBeInTheDocument()
  })

  it('renders the verdict chip, score (a raw number, never a percentage), text and generated-at caption', () => {
    render(<KoiosAdviceBlock namespace="applications" insights={[]} aiAdvice={{
      verdict: 'proceed', score: 88, text: 'Strong fit for this role.', language: 'nl',
      generatedAt: '2026-09-01T09:00:00Z', runId: 'run-9',
    }} />)
    expect(screen.getByText('common:koios.advice.verdict.proceed')).toBeInTheDocument()
    // S1 repair NOTE 6 (EENHEID-LES): a 0-100 fit score, never a '%' suffix.
    expect(screen.getByText('common:koios.advice.score')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.queryByText('88%')).toBeNull()
    expect(screen.getByText('Strong fit for this role.')).toBeInTheDocument()
    expect(screen.getByText('common:koios.advice.generatedAt')).toBeInTheDocument()
  })

  // S1 repair NOTE 4: the heading's own KoiosAiMark already carries the AI-Act
  // disclosure hint — a second stacked AiGeneratedLabel would double the badge.
  it('never renders a second "AI-gegenereerd" label alongside the aiAdvice block', () => {
    render(<KoiosAdviceBlock namespace="applications" insights={[]} aiAdvice={{
      verdict: 'proceed', score: 88, text: 'Strong fit.', generatedAt: '2026-09-01T09:00:00Z', runId: 'run-9',
    }} />)
    expect(screen.queryByText('aiGenerated')).toBeNull()
  })

  it('disables the refresh button while a run is pending', () => {
    render(<KoiosAdviceBlock namespace="vacancies" insights={[]} aiAdvice={null}
      onRequestAdvice={() => {}} advicePending />)
    expect(screen.getByRole('button', { name: 'common:koios.advice.refresh' })).toBeDisabled()
    expect(screen.getByText('common:koios.advice.pending')).toBeInTheDocument()
  })

  it('shows the run notice when one is passed', () => {
    render(<KoiosAdviceBlock namespace="matches" insights={[]} aiAdvice={null}
      onRequestAdvice={() => {}} adviceNotice="A run is already in progress." />)
    expect(screen.getByText('A run is already in progress.')).toBeInTheDocument()
  })
})

// A reason that already ends a sentence must not produce a double period in the question.
describe('KoiosAdviceBlock · question composition', () => {
  it("strips the advice text's trailing period before interpolating it", async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const spy = vi.fn(); const { ASK_KOIOS_EVENT } = await import('@/lib/koiosBridge'); window.addEventListener(ASK_KOIOS_EVENT, (e: Event) => spy((e as CustomEvent).detail))
    const { render, screen } = await import('@testing-library/react')
    const Block = (await import('./KoiosAdviceBlock')).default
    render(<Block namespace="candidates" insights={[{ type: 'Plan intake', color: 'var(--color-primary)', text: 'Er is nog geen intake gepland.' }]} />)
    const rows = screen.getAllByText(/Plan intake/); rows[0].click()
    const btn = await screen.findByRole('button', { name: 'common:koios.assistant.askKoios' })
    await userEvent.click(btn)
    expect(String(spy.mock.calls[0]?.[0]?.text ?? '')).not.toMatch(/\.\./)
  })
})
