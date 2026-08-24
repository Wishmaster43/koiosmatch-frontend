/**
 * ConversationTab — proves the tab renders the shared ConversationsSection with
 * the EXACT contact-scoped URL when the opportunity carries a customer+contact
 * (mirrors ContactConversationsSection.test.tsx), falls back to the calm empty
 * state (and fetches nothing) when there is no contact, and keeps the e-mail log
 * visible below it either way.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import ConversationTab from './ConversationTab'
import type { Opportunity } from '@/types/opportunity'

// Keep the real unwrap/unwrapList helpers, mock only the axios instance (mirrors
// EmailTab.test.tsx and ContactConversationsSection.test.tsx).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const mockedGet = vi.mocked(api.get)

vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    formatDate: (v: unknown) => (v == null ? '—' : String(v)),
    formatDateTime: (v: unknown) => (v == null ? '—' : String(v)),
  }),
}))

afterEach(() => vi.clearAllMocks())

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1', title: 'Deal', description: '', initials: 'DA', client: 'Acme', clientId: 'c1',
    stage: 'Open', stageValue: 'open',
    // eslint-disable-next-line no-restricted-syntax -- seed DATA fixture hex mirroring a tenant stage-lookup colour, not UI styling
    stageColor: '#6FA8C4', value: null, currency: 'EUR', owner: '', ownerId: null,
    date: '2026-01-01', expectedCloseAt: null, dealTypeUnit: null, archived: false, archivedAt: null,
    lifecycle: null, pendingEraseAt: null, referenceNumber: '', contact: 'Jane', contactId: 'contact-1',
    tags: [], customFieldValues: {},
    ...overrides,
  } as Opportunity
}

function renderTab(o: Opportunity) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}><ConversationTab opportunity={o} /></QueryClientProvider>,
  )
}

describe('ConversationTab', () => {
  it('renders the contact-scoped conversations section with the exact URL and a real thread row', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/customers/c1/contacts/contact-1/conversations') return Promise.resolve({ data: { data: [
        // One REAL thread so the render path is proven, not just the request.
        { id: 'conv-1', wa_number: '+3161234****', status: 'active', last_inbound_at: null, messages: [] },
      ] } })
      if (url === '/email-log') return Promise.resolve({ data: { data: [], meta: { total: 0 } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderTab(opportunity())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(
      '/customers/c1/contacts/contact-1/conversations', { params: undefined },
    ))
    // The thread heading actually paints (masked number rendered verbatim, §8).
    expect(await screen.findByText(/3161234/)).toBeInTheDocument()
  })

  it('shows the calm no-contact empty state and never fetches conversations when unlinked', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/email-log') return Promise.resolve({ data: { data: [], meta: { total: 0 } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderTab(opportunity({ contactId: null }))
    expect(await screen.findByText(/Koppel eerst een contactpersoon/)).toBeInTheDocument()
    expect(mockedGet).not.toHaveBeenCalledWith(expect.stringContaining('/conversations'), expect.anything())
  })

  it('still shows the e-mail log below the conversation panel', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/customers/c1/contacts/contact-1/conversations') return Promise.resolve({ data: { data: [] } })
      if (url === '/email-log') return Promise.resolve({ data: { data: [{ id: 1, subject: 'Hi', direction: 'outbound' }], meta: { total: 1 } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderTab(opportunity())
    expect(await screen.findByText('Hi')).toBeInTheDocument()
  })
})
