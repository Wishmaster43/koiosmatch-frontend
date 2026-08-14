/**
 * AddLinkRow — request-level coverage for the customer_location wiring (CMBE
 * delivered GET /customer-locations?customer_id=&q=&per_page= 14-08). Asserts
 * the actual request (route + q/per_page params), the "(Customer Y)" label
 * convention, and that picking a row stages the exact { type, id, label } the
 * host modal (LinkCard) puts into the saved payload — not merely that a
 * callback fired (house rule §13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import AddLinkRow from './AddLinkRow'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data: unknown[] }) => ({ rows: r.data }),
}))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

describe('AddLinkRow — customer_location', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: [] })
  })

  it('fetches /customer-locations with q and per_page on the initial load', async () => {
    render(<AddLinkRow existing={[]} onAdd={vi.fn()} onClose={vi.fn()} types={['customer_location']} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/customer-locations', {
      params: expect.objectContaining({ q: '', search: '', per_page: 25 }),
    }))
  })

  it('re-searches /customer-locations with the typed q after the debounce', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'loc-1', name: 'Location X', customer_name: 'Customer Y' }],
    })
    render(<AddLinkRow existing={[]} onAdd={vi.fn()} onClose={vi.fn()} types={['customer_location']} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    const input = await screen.findByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'floor 2' } })

    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/customer-locations', {
      params: expect.objectContaining({ q: 'floor 2', search: 'floor 2', per_page: 25 }),
    }), { timeout: 2000 })
  })

  it('labels a row "Location X (Customer Y)" and stages that exact link on pick', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'loc-1', name: 'Location X', customer_name: 'Customer Y' }],
    })
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<AddLinkRow existing={[]} onAdd={onAdd} onClose={onClose} types={['customer_location']} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    await waitFor(() => expect(screen.getByText('Location X (Customer Y)')).toBeTruthy())
    fireEvent.click(screen.getByText('Location X (Customer Y)'))

    expect(onAdd).toHaveBeenCalledWith({ type: 'customer_location', id: 'loc-1', label: 'Location X (Customer Y)' })
    expect(onClose).toHaveBeenCalled()
  })
})
