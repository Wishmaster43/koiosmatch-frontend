/**
 * WaWebQueueTile — asserts the three headline figures render from the exact
 * server shape, the failed figure only reads the danger token when > 0, the
 * per-number rows render, and a click navigates to the WhatsApp queue tab.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WaWebQueueTile from './WaWebQueueTile'
import type { WaWebQueueFeed } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => opts ? `${k}:${JSON.stringify(opts)}` : k }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))

const feed: WaWebQueueFeed = {
  in_queue: 12,
  sending: 3,
  failed: 2,
  est_drain_hours: 2,
  devices: 1,
  numbers: [
    { number_id: 'n1', label: '+31 6 12345678', rate_limit: 50, in_queue: 8, est_drain: 1 },
    { number_id: 'n2', label: '+31 6 87654321', rate_limit: 50, in_queue: 4, est_drain: 1 },
  ],
}

describe('WaWebQueueTile', () => {
  it('renders the three figures and the per-number rows from the server shape', () => {
    render(<WaWebQueueTile feed={feed} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('+31 6 12345678')).toBeInTheDocument()
    expect(screen.getByText('+31 6 87654321')).toBeInTheDocument()
  })

  it('colors the failed figure with the danger token only when it is a real non-zero count', () => {
    const { rerender } = render(<WaWebQueueTile feed={feed} />)
    expect(screen.getByText('2')).toHaveStyle({ color: 'var(--color-danger-text)' })

    rerender(<WaWebQueueTile feed={{ ...feed, failed: 0 }} />)
    expect(screen.getByText('0')).toHaveStyle({ color: 'var(--text)' })
  })

  it('shows the est-drain caption only when est_drain_hours is not null', () => {
    const { rerender, queryByText } = render(<WaWebQueueTile feed={feed} />)
    expect(queryByText(/feed.waWebQueue.estDrain/)).toBeInTheDocument()

    rerender(<WaWebQueueTile feed={{ ...feed, est_drain_hours: null }} />)
    expect(queryByText(/feed.waWebQueue.estDrain/)).not.toBeInTheDocument()
  })

  it('navigates to the WhatsApp queue tab on click', () => {
    const onNavigate = vi.fn()
    render(<WaWebQueueTile feed={feed} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('+31 6 12345678'))
    expect(onNavigate).toHaveBeenCalledWith('whatsapp', { tab: 'wa-web-queue' })
  })

  // Predecessor audit 57be1399: a count and its click-through must show the same
  // population, so every headline figure deep-links with its OWN status.
  it('each headline count navigates pre-filtered on its own status', () => {
    const onNavigate = vi.fn()
    render(<WaWebQueueTile feed={feed} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('feed.waWebQueue.inQueue'))
    expect(onNavigate).toHaveBeenLastCalledWith('whatsapp', { tab: 'wa-web-queue', status: 'queued' })
    fireEvent.click(screen.getByText('feed.waWebQueue.sending'))
    expect(onNavigate).toHaveBeenLastCalledWith('whatsapp', { tab: 'wa-web-queue', status: 'sending' })
    fireEvent.click(screen.getByText('feed.waWebQueue.failed'))
    expect(onNavigate).toHaveBeenLastCalledWith('whatsapp', { tab: 'wa-web-queue', status: 'failed' })
  })
})
