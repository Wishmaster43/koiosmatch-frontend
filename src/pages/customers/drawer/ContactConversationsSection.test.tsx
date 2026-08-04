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
  default: { get: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))

const THREADS = [{ id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false }]

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/customers/cust-1/contacts/contact-1/conversations') return Promise.resolve({ data: { data: THREADS } })
    if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: [] } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
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
