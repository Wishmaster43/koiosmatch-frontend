/**
 * WaWebQueueLimits — asserts the GET populates the four fields, and PUT sends
 * exactly the controller's key set (§13: the request, not a fired callback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import WaWebQueueLimits from './WaWebQueueLimits'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn(), put: vi.fn() } }
})

describe('WaWebQueueLimits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET populates the four numeric fields', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { known_hourly_limit: 40, new_hourly_limit: 5, new_daily_limit: 30, new_weekly_limit: 120 } })
    render(<WaWebQueueLimits canManage />)

    await waitFor(() => expect(screen.getByDisplayValue('40')).toBeInTheDocument())
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/settings/whatsapp-queue')
  })

  it('PUT sends exactly the four controller keys after an edit', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { known_hourly_limit: 40, new_hourly_limit: 5, new_daily_limit: 30, new_weekly_limit: 120 } })
    vi.mocked(api.put).mockResolvedValue({ data: { known_hourly_limit: 60, new_hourly_limit: 5, new_daily_limit: 30, new_weekly_limit: 120 } })
    render(<WaWebQueueLimits canManage />)
    await waitFor(() => expect(screen.getByDisplayValue('40')).toBeInTheDocument())

    const user = userEvent.setup()
    const knownHourlyInput = screen.getByDisplayValue('40')
    await user.clear(knownHourlyInput)
    await user.type(knownHourlyInput, '60')
    await user.click(screen.getByText('whatsappWeb.queue.save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/whatsapp-queue',
      { known_hourly_limit: 60, new_hourly_limit: 5, new_daily_limit: 30, new_weekly_limit: 120 }))
  })

  it('load error state', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('nope'))
    render(<WaWebQueueLimits canManage />)
    await waitFor(() => expect(screen.getByText('whatsappWeb.queue.loadError')).toBeInTheDocument())
  })

  it('save error surfaces the extracted message', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { known_hourly_limit: 40, new_hourly_limit: 5, new_daily_limit: 30, new_weekly_limit: 120 } })
    vi.mocked(api.put).mockRejectedValue({ response: { status: 422, data: { message: 'Invalid.' } } })
    render(<WaWebQueueLimits canManage />)
    await waitFor(() => expect(screen.getByDisplayValue('40')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByText('whatsappWeb.queue.save'))

    await waitFor(() => expect(screen.getByText('Invalid.')).toBeInTheDocument())
  })

  it('renders read-only values and no Save button when canManage is false', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { known_hourly_limit: 40, new_hourly_limit: 5, new_daily_limit: 30, new_weekly_limit: 120 } })
    render(<WaWebQueueLimits canManage={false} />)

    await waitFor(() => expect(screen.getByText('40')).toBeInTheDocument())
    expect(screen.queryByDisplayValue('40')).not.toBeInTheDocument()
    expect(screen.queryByText('whatsappWeb.queue.save')).not.toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })
})
