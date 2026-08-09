/**
 * CandidateSummaryPopout — the four UI states (§3) plus the seam that actually
 * matters: saving from the popped-out window must issue the REAL candidate PATCH
 * (§13: assert the request, never just that a callback fired). `@/lib/api` is the
 * only thing mocked on the write path, so buildCandidatePatch and useCandidateRecord
 * run for real — a renamed field would fail here instead of 422-ing in production.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateSummaryPopout from './CandidateSummaryPopout'
import api from '@/lib/api'

// TipTap's editor is out of scope here (its own tests cover it) — a plain
// textarea keeps this a focused test of THIS page's wiring.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/lib/api', () => ({
  default: { patch: vi.fn(() => Promise.resolve({ data: {} })), get: vi.fn() },
  unwrap: (r: { data: unknown }) => r.data,
  getActiveTenantId: () => 'demo',
}))

// Mutable per-test candidate-lite state (vi.hoisted so the mock factory can read it).
const { liteState } = vi.hoisted(() => ({
  liteState: {
    candidate: null as { id: string; name: string; initials: string; summary: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('./hooks/useCandidateLite', () => ({ useCandidateLite: () => liteState }))

describe('CandidateSummaryPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.candidate = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the candidate loads', () => {
    liteState.loading = true
    render(<CandidateSummaryPopout id="c1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<CandidateSummaryPopout id="c1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  it('loads the stored profile text into the editor and starts clean', () => {
    liteState.candidate = { id: 'c1', name: 'Lieke Blom', initials: 'LB', summary: '<p>Ervaren</p>' }
    render(<CandidateSummaryPopout id="c1" />)
    expect(screen.getByText('Lieke Blom')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Ervaren</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  // Danny 09-08: "bij opslaan van pop-out sluit het venster niet". Saving now sends
  // the real PATCH and then closes the window — the assertion is the CLOSE, not a
  // disabled button (the button is gone with the window by then).
  it('PATCHes /candidates/{id} with the edited summary and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.candidate = { id: 'c1', name: 'Lieke Blom', initials: 'LB', summary: 'a' }
    render(<CandidateSummaryPopout id="c1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    expect(screen.getByTestId('text-popout-save')).toBeEnabled()
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/candidates/c1', { summary: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  // The other half of the same rule: a REJECTED write must keep the window open,
  // or the recruiter's text disappears with it.
  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.candidate = { id: 'c1', name: 'Lieke Blom', initials: 'LB', summary: 'a' }
    render(<CandidateSummaryPopout id="c1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
