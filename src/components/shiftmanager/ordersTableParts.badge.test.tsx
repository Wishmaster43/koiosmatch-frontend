/**
 * ordersTableParts.StatusBadge — the order status word is a Shiftmanager server vocabulary:
 * a known status renders its shiftmanager:orders.status.<key> copy through the real i18n
 * instance, an unknown status renders the raw server word (never a key path), no status a dash.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import nlShiftmanager from '@/i18n/locales/nl/shiftmanager.json'
import { StatusBadge } from './ordersTableParts'

describe('ordersTableParts · StatusBadge', () => {
  it('renders the translated label for a known status', () => {
    render(<StatusBadge status="open" />)
    expect(screen.getByText(nlShiftmanager.orders.status.open)).toBeInTheDocument()
  })

  it('renders the raw server word for an unknown status and a dash without one', () => {
    render(<StatusBadge status="zz_future_status" />)
    expect(screen.getByText('zz_future_status')).toBeInTheDocument()
    expect(screen.queryByText('orders.status.zz_future_status')).not.toBeInTheDocument()
    render(<StatusBadge />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
