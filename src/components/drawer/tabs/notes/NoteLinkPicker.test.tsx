/**
 * NoteLinkPicker — request-level coverage for the customer principal endpoint
 * (contract audit ENT2-01: the picker always sent q/search, even empty, and
 * several PRINCIPAL_ENDPOINTS — customers among them — 422'd on the resulting
 * null value). Mirrors AddLinkRow.test.tsx's mocking style (§13: assert the
 * actual request, never merely that a callback fired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import NoteLinkPicker from './NoteLinkPicker'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data: unknown[] }) => ({ rows: r.data }),
}))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// i18n is not initialised in this file → t() returns the key, so the SelectMenu
// trigger/options and the SearchSelect trigger are found by their raw i18n keys.
describe('NoteLinkPicker — customer principal', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: [] })
  })

  it('fetches /customers with per_page only on an empty query — no q/search key at all', async () => {
    const user = userEvent.setup()
    render(<NoteLinkPicker existing={[]} onAdd={vi.fn()} onClose={vi.fn()} busy={false} />)
    // Default type is 'candidate' — switch to 'customer', one of the endpoints
    // ENT2-01 measured as 422-prone on an always-sent empty q/search.
    await user.click(screen.getByRole('button', { name: 'notes.links.type.candidate' }))
    await user.click(screen.getByRole('button', { name: 'notes.links.type.customer' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/customers', { params: { per_page: 25 } }))
  })

  it('re-searches /customers with q/search once a query is typed', async () => {
    const user = userEvent.setup()
    render(<NoteLinkPicker existing={[]} onAdd={vi.fn()} onClose={vi.fn()} busy={false} />)
    await user.click(screen.getByRole('button', { name: 'notes.links.type.candidate' }))
    await user.click(screen.getByRole('button', { name: 'notes.links.type.customer' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/customers', { params: { per_page: 25 } }))

    fireEvent.click(screen.getByRole('button', { name: 'notes.links.pickEntity' }))
    const input = await screen.findByPlaceholderText('search')
    fireEvent.change(input, { target: { value: 'Acme' } })

    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/customers', {
      params: { q: 'Acme', search: 'Acme', per_page: 25 },
    }))
  })
})
