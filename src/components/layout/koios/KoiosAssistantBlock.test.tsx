/**
 * KoiosAssistantBlock — flat mocks, mocked GET. Verifies server-order
 * rendering, ref deep-links via the mocked NavigationContext, the
 * empty/error states, and the action-hint chip's honest gating.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosAssistantBlock from './KoiosAssistantBlock'
import api from '@/lib/api'

// GET /ai/koios/assistant — the only endpoint this block calls.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// openEntity spy for the ref deep-link assertion (KoiosResultCards reads useNavigation()).
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// Fresh QueryClient per test so cache never leaks between cases.
function renderBlock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><KoiosAssistantBlock /></QueryClientProvider>)
}

beforeEach(() => {
  mockGet.mockReset()
  openEntity.mockReset()
  localStorage.clear()
})

describe('KoiosAssistantBlock', () => {
  it('renders suggestion cards in the exact server order', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { suggestions: [
      { kind: 'task_overdue', title: 'First task', body: 'Body one', refs: [] },
      { kind: 'candidate_no_contact', title: 'Second lead', body: 'Body two', refs: [] },
    ] } } })
    renderBlock()
    const titles = await screen.findAllByText(/First task|Second lead/)
    expect(titles.map((el) => el.textContent)).toEqual(['First task', 'Second lead'])
    expect(screen.getByText('Body one')).toBeInTheDocument()
    expect(screen.getByText('Body two')).toBeInTheDocument()
  })

  it('deep-links a suggestion ref via openEntity', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { suggestions: [
      { kind: 'pending_action', title: 'Follow up', body: 'Do it', refs: [{ type: 'candidate', id: '42', label: 'Jane Doe' }] },
    ] } } })
    renderBlock()
    const card = await screen.findByText('Jane Doe')
    fireEvent.click(card)
    expect(openEntity).toHaveBeenCalledWith('candidates', '42')
  })

  it('shows the empty state when there are zero suggestions', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { suggestions: [] } } })
    renderBlock()
    expect(await screen.findByText('koios.assistant.emptyState')).toBeInTheDocument()
  })

  it('shows a subtle error with retry, and retry refetches', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    mockGet.mockResolvedValueOnce({ data: { data: { suggestions: [] } } })
    renderBlock()
    await screen.findByText('error.body')
    fireEvent.click(screen.getByText('error.retry'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    // The SEAM, not just the count (§13): both calls hit the K-148 route.
    expect(mockGet).toHaveBeenNthCalledWith(1, '/ai/koios/assistant')
    expect(mockGet).toHaveBeenNthCalledWith(2, '/ai/koios/assistant')
  })

  it('renders the action-available hint chip only when a suggestion carries an action', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { suggestions: [
      { kind: 'pending_action', title: 'With action', body: 'Has one', refs: [], action: { tool: 'send_message', input: {} } },
      { kind: 'task_overdue', title: 'Without action', body: 'Has none', refs: [] },
    ] } } })
    renderBlock()
    await screen.findByText('With action')
    expect(screen.getAllByText('koios.assistant.actionAvailable')).toHaveLength(1)
  })
})
