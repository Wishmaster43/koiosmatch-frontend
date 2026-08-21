/**
 * OpportunityDescriptionPopout — DRILLDOWN-VOLGORDE-CANON (21-08): four UI
 * states + the seam that actually matters, saving from the popped-out window
 * issues the REAL opportunity PATCH (§13: assert the request, never only
 * that a callback fired). Mirrors MatchTextPopout.test.tsx 1:1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityDescriptionPopout from './OpportunityDescriptionPopout'
import api from '@/lib/api'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/lib/api', () => ({
  default: { patch: vi.fn(() => Promise.resolve({ data: {} })), get: vi.fn() },
  unwrap: (r: { data: unknown }) => r.data,
  unwrapList: (r: { data: unknown }) => ({ rows: r.data }),
  getActiveTenantId: () => 'demo',
}))

const { liteState } = vi.hoisted(() => ({
  liteState: {
    opportunity: null as { id: string; title: string; initials: string; description: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('../hooks/useOpportunityTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useOpportunityTextPopout')>()
  return { ...actual, useOpportunityTextLite: () => liteState }
})

describe('OpportunityDescriptionPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.opportunity = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the opportunity loads', () => {
    liteState.loading = true
    render(<OpportunityDescriptionPopout id="o-1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<OpportunityDescriptionPopout id="o-1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  it('loads the stored description into the editor and starts clean', () => {
    liteState.opportunity = { id: 'o-1', title: '5 verpleegkundigen', initials: '5V', description: '<p>Huidige tekst</p>' }
    render(<OpportunityDescriptionPopout id="o-1" />)
    expect(screen.getByText('5 verpleegkundigen')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Huidige tekst</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  it('PATCHes /opportunities/{id} with the edited description and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.opportunity = { id: 'o-1', title: '5 verpleegkundigen', initials: '5V', description: 'a' }
    render(<OpportunityDescriptionPopout id="o-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/o-1', { description: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.opportunity = { id: 'o-1', title: '5 verpleegkundigen', initials: '5V', description: 'a' }
    render(<OpportunityDescriptionPopout id="o-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })

  it('regression: clears to description: null when the editor emits the TipTap empty-paragraph artifact, not the literal markup (hasDescriptionText, §11)', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.opportunity = { id: 'o-1', title: '5 verpleegkundigen', initials: '5V', description: '<p>Was hier</p>' }
    render(<OpportunityDescriptionPopout id="o-1" />)
    const editor = screen.getByLabelText('editor')
    await user.clear(editor)
    await user.type(editor, '<p></p>')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/o-1', { description: null })
    close.mockRestore()
  })
})
