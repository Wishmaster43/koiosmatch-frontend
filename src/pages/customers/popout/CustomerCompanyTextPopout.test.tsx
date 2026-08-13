/**
 * CustomerCompanyTextPopout — K3 (batch 5): four UI states + the seam that
 * actually matters, saving from the popped-out window issues the REAL customer
 * PATCH (§13: assert the request, never only that a callback fired). Mirrors
 * CandidateSummaryPopout.test.tsx 1:1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerCompanyTextPopout from './CustomerCompanyTextPopout'
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
    customer: null as { id: string; name: string; initials: string; description: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('../hooks/useCustomerTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useCustomerTextPopout')>()
  return { ...actual, useCustomerTextLite: () => liteState }
})

describe('CustomerCompanyTextPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.customer = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the customer loads', () => {
    liteState.loading = true
    render(<CustomerCompanyTextPopout id="cust-1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<CustomerCompanyTextPopout id="cust-1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  it('loads the stored company text into the editor and starts clean', () => {
    liteState.customer = { id: 'cust-1', name: 'Acme Zorg', initials: 'AZ', description: '<p>Zorgorganisatie</p>' }
    render(<CustomerCompanyTextPopout id="cust-1" />)
    expect(screen.getByText('Acme Zorg')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Zorgorganisatie</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  it('PATCHes /customers/{id} with the edited description and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.customer = { id: 'cust-1', name: 'Acme Zorg', initials: 'AZ', description: 'a' }
    render(<CustomerCompanyTextPopout id="cust-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/customers/cust-1', { description: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.customer = { id: 'cust-1', name: 'Acme Zorg', initials: 'AZ', description: 'a' }
    render(<CustomerCompanyTextPopout id="cust-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
