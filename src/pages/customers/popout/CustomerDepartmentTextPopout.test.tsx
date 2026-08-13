/**
 * CustomerDepartmentTextPopout — K5a (batch 5): four UI states + the seam that
 * actually matters, saving issues the REAL nested PATCH
 * /customers/{cid}/departments/{id} (§13). Mirrors CustomerCompanyTextPopout.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerDepartmentTextPopout from './CustomerDepartmentTextPopout'
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
    department: null as { id: string; customerId: string; name: string; description: string } | null,
    loading: false, error: false, reload: vi.fn(),
  },
}))
vi.mock('../hooks/useCustomerTextPopout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useCustomerTextPopout')>()
  return { ...actual, useDepartmentTextLite: () => liteState }
})

describe('CustomerDepartmentTextPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.department = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    vi.mocked(api.patch).mockClear()
  })
  afterEach(() => { document.title = previousTitle })

  // A malformed/legacy id (no `<customerId>:<departmentId>` pair) — an honest
  // error state, never a wrong fetch (§3).
  it('shows an error for a malformed composite id', () => {
    render(<CustomerDepartmentTextPopout id="not-composite" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows a loading skeleton while the department loads', () => {
    liteState.loading = true
    render(<CustomerDepartmentTextPopout id="cust-1:dep-1" />)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with a retry that re-runs the fetch', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<CustomerDepartmentTextPopout id="cust-1:dep-1" />)
    await user.click(screen.getByRole('button'))
    expect(liteState.reload).toHaveBeenCalled()
  })

  it('loads the stored department text into the editor and starts clean', () => {
    liteState.department = { id: 'dep-1', customerId: 'cust-1', name: 'Dagbesteding', description: '<p>Omschrijving</p>' }
    render(<CustomerDepartmentTextPopout id="cust-1:dep-1" />)
    expect(screen.getByText('Dagbesteding')).toBeInTheDocument()
    expect(screen.getByLabelText('editor')).toHaveValue('<p>Omschrijving</p>')
    expect(screen.getByTestId('text-popout-save')).toBeDisabled()
  })

  it('PATCHes /customers/{cid}/departments/{id} with the edited description and then closes the window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.department = { id: 'dep-1', customerId: 'cust-1', name: 'Dagbesteding', description: 'a' }
    render(<CustomerDepartmentTextPopout id="cust-1:dep-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalledWith('/customers/cust-1/departments/dep-1', { description: 'ab' })
    expect(close).toHaveBeenCalled()
    close.mockRestore()
  })

  it('keeps the window open when the server refuses the write', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 422 } })
    liteState.department = { id: 'dep-1', customerId: 'cust-1', name: 'Dagbesteding', description: 'a' }
    render(<CustomerDepartmentTextPopout id="cust-1:dep-1" />)
    await user.type(screen.getByLabelText('editor'), 'b')
    await user.click(screen.getByTestId('text-popout-save'))
    expect(api.patch).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
