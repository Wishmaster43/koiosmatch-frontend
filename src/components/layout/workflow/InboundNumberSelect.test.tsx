/** InboundNumberSelect — lane filter, source switch clearing and failure state. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InboundNumberSelect } from './InboundNumberSelect'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

const rows = [
  { value: 'n-meta', label: 'Meta line', group: 'meta' },
  { value: 'n-web', label: 'Web device', group: 'wa_web' },
]

describe('InboundNumberSelect', () => {
  it('fetches /inbound-numbers once and offers only the lane numbers', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: rows } } as never)
    render(<InboundNumberSelect source="meta" numberId="" onSourceChange={vi.fn()} onNumberChange={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /fieldLabels.WhatsApp number/ }))
    expect(screen.getByRole('button', { name: 'Meta line' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Web device' })).not.toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/inbound-numbers')
  })

  it('switching the source drops a number of the other lane', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: rows } } as never)
    const onSource = vi.fn(); const onNumber = vi.fn()
    render(<InboundNumberSelect source="meta" numberId="n-meta" onSourceChange={onSource} onNumberChange={onNumber} />)
    await screen.findByRole('button', { name: /Meta line/ })
    fireEvent.click(screen.getByRole('button', { name: /fieldLabels.Source/ }))
    fireEvent.click(screen.getByRole('button', { name: 'scheduleModal.sourceWaWeb' }))
    expect(onSource).toHaveBeenCalledWith('wa_web')
    expect(onNumber).toHaveBeenCalledWith('')
  })

  it('a failed fetch shows the error, never the empty-lane note', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'))
    render(<InboundNumberSelect source="meta" numberId="" onSourceChange={vi.fn()} onNumberChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('scheduleModal.noInboundNumbers')).not.toBeInTheDocument()
  })

  // I-002: the retry action reloads the list after a failure.
  it('retry after a failed fetch loads the lane numbers', async () => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: { data: rows } } as never)
    render(<InboundNumberSelect source="meta" numberId="" onSourceChange={vi.fn()} onNumberChange={vi.fn()} />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: /fieldLabels.WhatsApp number/ })).toBeInTheDocument()
  })

  // I-002: a stored number the list no longer carries shows the notice, never the raw id.
  it('a stored number absent from the list shows the unavailable notice and not the id', async () => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: { data: rows } } as never)
    render(<InboundNumberSelect source="meta" numberId="gone-uuid" onSourceChange={vi.fn()} onNumberChange={vi.fn()} />)
    expect(await screen.findByText('scheduleModal.numberUnavailable')).toBeInTheDocument()
    expect(screen.queryByText('gone-uuid')).not.toBeInTheDocument()
  })

  // Regression lock: switching lane while the list is still pending clears the number.
  it('switching the source while the list is still loading clears the number', () => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}) as never)
    const onNumber = vi.fn()
    render(<InboundNumberSelect source="meta" numberId="n-meta" onSourceChange={vi.fn()} onNumberChange={onNumber} />)
    fireEvent.click(screen.getByRole('button', { name: /fieldLabels.Source/ }))
    fireEvent.click(screen.getByRole('button', { name: 'scheduleModal.sourceWaWeb' }))
    expect(onNumber).toHaveBeenCalledWith('')
  })
})
