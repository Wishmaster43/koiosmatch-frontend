/**
 * ContactConversationsSection — GESPREK-CONTACT-1. Proves the wrapper builds
 * the CORRECT nested request (method + route) to the contact-scoped
 * conversations endpoint, delegating everything else to the already-tested
 * shared ConversationsSection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ContactConversationsSection from './ContactConversationsSection'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))
// CONTACT-CONVERSATION-START: hasPermission drives the PII gate (customers.view) —
// each test below sets the return explicitly, mirroring CustomersBulkBar.test.jsx.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

const THREADS = [{ id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false }]

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/customers/cust-1/contacts/contact-1/conversations') return Promise.resolve({ data: { data: THREADS } })
    if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: [] } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
  mockUseAuth.mockReset()
  mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'customers.view' })
})

describe('ContactConversationsSection', () => {
  it('fetches the contact-scoped conversations endpoint (GESPREK-CONTACT-1)', async () => {
    render(<ContactConversationsSection customerId="cust-1" contactId="contact-1" />)
    // The request must hit the nested customer/contact route, with no extra params
    // (the id is already in the path, unlike the candidate's flat + query-param variant).
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/cust-1/contacts/contact-1/conversations', { params: undefined }))
    expect(await screen.findByText('+31612345678')).toBeInTheDocument()
  })

  it('reads as empty on a 404 (contact has no threads yet), not broken', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/customers/cust-2/contacts/contact-2/conversations') {
        return Promise.reject({ response: { status: 404 } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ContactConversationsSection customerId="cust-2" contactId="contact-2" />)
    expect(await screen.findByText('sections.conversationsEmpty')).toBeInTheDocument()
  })
})

// CONTACT-CONVERSATION-START: the "Conversatie starten" trigger — PII-gated on
// customers.view (§8) and disabled without a mobile number (§3, honest affordances).
describe('ContactConversationsSection · start affordance (CONTACT-CONVERSATION-START)', () => {
  it('shows an enabled start trigger with customers.view and a mobile number', async () => {
    render(<ContactConversationsSection customerId="cust-1" contactId="contact-1" mobile="+31612345678" />)
    expect(await screen.findByRole('button', { name: 'conversations.start' })).not.toBeDisabled()
  })

  it('disables the trigger with an honest reason when the contact has no mobile number', async () => {
    render(<ContactConversationsSection customerId="cust-1" contactId="contact-1" mobile={null} />)
    expect(await screen.findByRole('button', { name: 'conversations.start' })).toBeDisabled()
  })

  it('hides the start trigger entirely without customers.view — the PII gate', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<ContactConversationsSection customerId="cust-1" contactId="contact-1" mobile="+31612345678" />)
    await screen.findByText('+31612345678')
    expect(screen.queryByRole('button', { name: 'conversations.start' })).toBeNull()
  })
})
