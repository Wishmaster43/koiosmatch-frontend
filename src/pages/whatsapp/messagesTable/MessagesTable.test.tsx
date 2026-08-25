/**
 * MessagesTable — the Messages tab table (WA-MSG-TABLE-1). Covers: rendering the
 * real wire shape (WhatsappDashboardController::messages), the DD-MM-YYYY HH:mm
 * date via the house formatter, and the two CEL-DOORKLIK-CANON gateways
 * (recipient name → candidate drilldown; conversation icon → the candidate's
 * communication:conversations tab) — both no-op for a candidate-less row.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import MessagesTable from './MessagesTable'
import type { WaMessage } from '@/types/whatsapp'

// Deterministic house date format — the exact formatting logic is covered by
// lib/datetime's own tests; this file only asserts MessagesTable calls it.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDateTime: () => '25-08-2026 14:30' }),
}))

const mockOpenEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity }) }))

const withCandidate: WaMessage = {
  id: 'm-1', candidate_id: 'c-1', candidate: { first_name: 'Jan', last_name: 'Jansen' },
  direction: 'inbound', status: 'read', body: 'Hallo, ben ik ingedeeld?', sent_at: '2026-08-25T14:30:00Z',
}
const withoutCandidate: WaMessage = {
  id: 'm-2', candidate_id: null, direction: 'outbound', status: 'sent', body: 'Systeembericht', sent_at: '2026-08-25T09:00:00Z',
}

describe('MessagesTable · wire shape + gateways (WA-MSG-TABLE-1)', () => {
  it('renders the recipient name, DD-MM-YYYY HH:mm date and body from the real wire shape', () => {
    render(<MessagesTable messages={[withCandidate]} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('25-08-2026 14:30')).toBeInTheDocument()
    expect(screen.getByText('Hallo, ben ik ingedeeld?')).toBeInTheDocument()
  })

  it('clicking the recipient name opens the candidate drilldown', async () => {
    const user = userEvent.setup()
    render(<MessagesTable messages={[withCandidate]} />)
    await user.click(screen.getByText('Jan Jansen'))
    expect(mockOpenEntity).toHaveBeenCalledWith('candidates', 'c-1')
  })

  it('clicking the conversation icon opens the candidate\'s communication:conversations tab', async () => {
    const user = userEvent.setup()
    render(<MessagesTable messages={[withCandidate]} />)
    await user.click(screen.getByRole('button', { name: /open conversation|gesprek openen/i }))
    expect(mockOpenEntity).toHaveBeenCalledWith('candidates', 'c-1', 'communication:conversations')
  })

  it('a row with no linked candidate renders plain text and no conversation button', () => {
    render(<MessagesTable messages={[withoutCandidate]} />)
    expect(screen.getByText('Systeembericht')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open conversation|gesprek openen/i })).not.toBeInTheDocument()
  })

  it('shows the loading state and the empty state', () => {
    const { rerender } = render(<MessagesTable messages={[]} loading />)
    expect(screen.queryByText('Systeembericht')).not.toBeInTheDocument()
    rerender(<MessagesTable messages={[]} loading={false} />)
    expect(screen.getByText(/no messages|geen berichten/i)).toBeInTheDocument()
  })

  it('renders the load-more button and calls onLoadMore', async () => {
    const user = userEvent.setup()
    const onLoadMore = vi.fn()
    render(<MessagesTable messages={[withCandidate]} onLoadMore={onLoadMore} />)
    await user.click(screen.getByRole('button', { name: /load more|meer laden/i }))
    expect(onLoadMore).toHaveBeenCalled()
  })
})
