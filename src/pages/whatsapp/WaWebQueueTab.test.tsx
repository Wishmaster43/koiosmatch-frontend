/**
 * WaWebQueueTab — K-193 fase 1: renders rows from the exact wire shape
 * (WhatsappQueueController::row — no nested `number`, `hold_reason` a slug).
 * `priority` is a raw internal magnitude (PRIORITY_BASE - sort_order) with no
 * recruiter-facing scale, so it is never rendered — rows arrive server-sorted
 * by it instead (§ SCHERMWAARHEID no raw machine value on screen). Permission
 * gate hides the action column, and each row action asserts its exact route (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import WaWebQueueTab from './WaWebQueueTab'
import type { WaWebQueueRow, WaWebQueueNumberStats } from './hooks/useWaWebQueue'

const mockList = vi.fn()
const mockStats = vi.fn()
const sendNowMutate = vi.fn()
const pauseMutate = vi.fn()
const retryMutate = vi.fn()
const cancelMutate = vi.fn()
vi.mock('./hooks/useWaWebQueue', () => ({
  useWaWebQueueList: (status?: string) => mockList(status),
  useWaWebQueueStats: (active: boolean) => mockStats(active),
  useWaWebQueueActions: () => ({
    sendNow: { mutate: sendNowMutate }, pause: { mutate: pauseMutate },
    retry: { mutate: retryMutate }, cancel: { mutate: cancelMutate },
  }),
}))

const row = (over: Partial<WaWebQueueRow>): WaWebQueueRow => ({
  id: 'q1', candidate: { id: 'c1', name: 'Jane Doe' },
  // eslint-disable-next-line no-restricted-syntax -- DATA: a tenant message-type's own stored colour, not UI styling
  message_type: { value: 'reminder', label: 'Herinnering', color: '#123456' },
  priority: 7, status: 'queued', attempts: 0, scheduled_at: '2026-08-25T10:00:00Z', number_id: 'n1', hold_reason: 'rate_limit',
  ...over,
})
const stats = (over: Partial<WaWebQueueNumberStats> = {}): WaWebQueueNumberStats =>
  ({ number_id: 'n1', label: 'Device A', rate_limit: 20, in_queue: 3, est_drain: 1, ...over })

afterEach(() => vi.clearAllMocks())

describe('WaWebQueueTab', () => {
  it('renders queue rows with translated status/hold reason, no raw priority integer', () => {
    mockList.mockReturnValue({ data: [row({})], isLoading: false, isError: false })
    mockStats.mockReturnValue({ data: [stats()], isLoading: false })
    render(<WaWebQueueTab status="" canManage={false} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // The raw priority integer never reaches the screen (it is an arbitrary
    // internal magnitude, not a recruiter-facing value) — rows arrive server-sorted.
    expect(screen.queryByText('7')).not.toBeInTheDocument()
    // "Device A" appears both in the stats card and the row's number column.
    expect(screen.getAllByText('Device A').length).toBeGreaterThan(0)
  })

  it('hides row actions when canManage is false', () => {
    mockList.mockReturnValue({ data: [row({})], isLoading: false, isError: false })
    mockStats.mockReturnValue({ data: [], isLoading: false })
    render(<WaWebQueueTab status="" canManage={false} />)
    expect(screen.queryByRole('button', { name: /verstuur nu|send now|pauzeren|pause|opnieuw proberen|retry|annuleren|cancel/i })).not.toBeInTheDocument()
  })

  it('send-now action calls the mutation with the row id', async () => {
    mockList.mockReturnValue({ data: [row({ status: 'paused' })], isLoading: false, isError: false })
    mockStats.mockReturnValue({ data: [], isLoading: false })
    render(<WaWebQueueTab status="" canManage />)
    await userEvent.click(screen.getByRole('button', { name: /verstuur nu|send now/i }))
    expect(sendNowMutate).toHaveBeenCalledWith('q1')
  })

  it('cancel action calls the mutation with the row id', async () => {
    mockList.mockReturnValue({ data: [row({ status: 'queued' })], isLoading: false, isError: false })
    mockStats.mockReturnValue({ data: [], isLoading: false })
    render(<WaWebQueueTab status="" canManage />)
    await userEvent.click(screen.getByRole('button', { name: /annuleren|cancel/i }))
    expect(cancelMutate).toHaveBeenCalledWith('q1')
  })

  it('forwards the status filter to the list hook', () => {
    mockList.mockReturnValue({ data: [], isLoading: false, isError: false })
    mockStats.mockReturnValue({ data: [], isLoading: false })
    render(<WaWebQueueTab status="failed" canManage={false} />)
    expect(mockList).toHaveBeenCalledWith('failed')
  })
})
