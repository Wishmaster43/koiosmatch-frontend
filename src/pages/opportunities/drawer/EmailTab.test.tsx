/**
 * EmailTab (opportunities) — KANSEN-VERDIEPING-PLAN DEEL 2 fase A item 5. Mirrors
 * StatisticsTab.test.tsx's quality bar: real (nl) i18n, no vacuous assertions, and
 * the request itself is asserted (§13) — both the list call (entity_type/entity_id
 * scoping) and the lazy per-row body call (GET /email-log/{id} with the same
 * entity params, the IDOR scope the backend enforces).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import EmailTab from './EmailTab'
import type { Opportunity } from '@/types/opportunity'

// Keep the real unwrap/unwrapList helpers, mock only the axios instance itself
// (mirrors hooks/useOpportunitiesData.test.tsx's own '@/lib/api' mock).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const mockedGet = vi.mocked(api.get)

// DD-MM-YYYY date formatter mock (mirrors OpportunitiesTable.test.tsx's own top-of-file
// mock) — DATUM-1: the timestamp cell must prove the house format renders, never an
// identity passthrough of the raw ISO string.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    formatDateTime: (v: unknown) => (v == null ? '—' : String(v).split('T')[0].split('-').reverse().join('-')),
  }),
}))
// Real (nl) translations, since mocking '@/lib/datetime' above removes the
// transitive '@/i18n' side-effect import the production component relies on.
import '@/i18n'

afterEach(() => vi.clearAllMocks())

const OPP_ID = 'opp-1'

// Minimal-but-typed fixture (only `id` is actually read by EmailTab); mirrors
// StatisticsTab.test.tsx's own row() factory for the same entity type.
function opportunity(): Opportunity {
  return {
    id: OPP_ID, title: 'Deal', description: '', initials: 'DA', client: 'Acme', clientId: 'c1',
    stage: 'Open', stageValue: 'open',
    // eslint-disable-next-line no-restricted-syntax -- seed DATA fixture hex mirroring a tenant stage-lookup colour, not UI styling
    stageColor: '#6FA8C4', value: null, currency: 'EUR', owner: '', ownerId: null,
    date: '2026-01-01', expectedCloseAt: null, dealTypeUnit: null, archived: false, archivedAt: null,
    lifecycle: 'active', pendingEraseAt: null, hours: null, hoursPeriod: 'week', startDate: null, endDate: null,
    serviceType: '', serviceTypeValue: null, serviceTypeColor: '', serviceTypeId: null,
    agreementType: '', agreementTypeValue: null, agreementTypeColor: '', agreementTypeId: null,
    location: '', locationId: null, department: '', departmentId: null, contact: '', contactId: null,
    branch: '', branchId: null, tags: [], customFieldValues: {},
  } as Opportunity
}

const EMAIL_ROW = {
  id: 'e1', direction: 'inbound', from: 'klant@bedrijf.nl', to: 'recruiter@koios.nl',
  subject: 'Vraag over tarief', status: 'delivered', created_at: '2026-08-20T10:15:00Z', entity_id: OPP_ID,
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <EmailTab opportunity={opportunity()} />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('EmailTab · the list request', () => {
  it('calls GET /email-log with entity_type=opportunity and entity_id scoped to this deal', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    renderTab()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    const call = mockedGet.mock.calls.find(c => c[0] === '/email-log')
    // per_page 200 = the backend's MAX_PER_PAGE — its default page of 50 hid rows silently.
    expect(call?.[1]?.params).toEqual({ entity_type: 'opportunity', entity_id: OPP_ID, per_page: 200 })
  })
})

describe('EmailTab · four states', () => {
  it('shows the loading state before the request settles', () => {
    mockedGet.mockReturnValue(new Promise(() => { /* never resolves within this test */ }))
    renderTab()
    expect(screen.getByText(i18n.t('opportunities:email.loading'))).toBeInTheDocument()
  })

  it('shows the honest error state on a non-403 failure', async () => {
    mockedGet.mockRejectedValue(new Error('network boom'))
    renderTab()
    await waitFor(() => expect(screen.getByText(i18n.t('opportunities:email.error'))).toBeInTheDocument())
  })

  it('shows the no-access notice on a 403 (settings.view gate), never the generic error', async () => {
    mockedGet.mockRejectedValue({ response: { status: 403 } })
    renderTab()
    await waitFor(() => expect(screen.getByText(i18n.t('opportunities:email.noAccess'))).toBeInTheDocument())
    expect(screen.queryByText(i18n.t('opportunities:email.error'))).not.toBeInTheDocument()
  })

  it('shows the italic muted empty note when there are no e-mails', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    renderTab()
    await waitFor(() => {
      const note = screen.getByText(i18n.t('opportunities:email.empty'))
      expect(note).toBeInTheDocument()
      expect(note).toHaveStyle({ fontStyle: 'italic' })
    })
  })

  it('renders a success row with the party, subject and a DD-MM-YYYY timestamp', async () => {
    mockedGet.mockResolvedValue({ data: { data: [EMAIL_ROW] } })
    renderTab()
    await waitFor(() => expect(screen.getByText('klant@bedrijf.nl')).toBeInTheDocument())
    expect(screen.getByText('Vraag over tarief')).toBeInTheDocument()
    expect(screen.getByText('20-08-2026')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('says so when the server holds more mail than the fetched page (no silent caps)', async () => {
    // Laravel paginate shape: meta at the top level next to `data`.
    mockedGet.mockResolvedValue({ data: { data: [EMAIL_ROW], total: 240, current_page: 1, last_page: 2, per_page: 200 } })
    renderTab()
    await waitFor(() => expect(
      screen.getByText(i18n.t('opportunities:email.showingOf', { shown: 1, total: 240 })),
    ).toBeInTheDocument())
  })
})

describe('EmailTab · inline expand (never a second overlay drawer)', () => {
  it('lazily fetches the body via GET /email-log/{id} with the same entity params, and reveals it inline', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [EMAIL_ROW] } }
      if (url === `/email-log/${EMAIL_ROW.id}`) return { data: { data: { ...EMAIL_ROW, body: 'Kunnen we morgen bellen over het tarief?' } } }
      throw new Error(`unexpected url ${url}`)
    })
    const user = userEvent.setup()
    renderTab()

    const row = await screen.findByRole('button')
    expect(row).toHaveAttribute('aria-expanded', 'false')

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')

    // The body call fires only on expand, and only for this one row's id.
    await waitFor(() => expect(screen.getByText('Kunnen we morgen bellen over het tarief?')).toBeInTheDocument())
    const bodyCall = mockedGet.mock.calls.find(c => c[0] === `/email-log/${EMAIL_ROW.id}`)
    expect(bodyCall?.[1]?.params).toEqual({ entity_type: 'opportunity', entity_id: OPP_ID })
  })

  it('shows the no-access notice inside the expand when the body read 403s', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [EMAIL_ROW] } }
      return Promise.reject({ response: { status: 403 } })
    })
    const user = userEvent.setup()
    renderTab()

    const row = await screen.findByRole('button')
    await user.click(row)
    await waitFor(() => expect(screen.getByText(i18n.t('opportunities:email.body.noAccess'))).toBeInTheDocument())
  })

  it('shows the body loading line while the lazy fetch is in flight', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/email-log') return Promise.resolve({ data: { data: [EMAIL_ROW] } })
      return new Promise(() => { /* body fetch never settles within this test */ })
    })
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole('button'))
    expect(screen.getByText(i18n.t('opportunities:email.body.loading'))).toBeInTheDocument()
  })

  it('shows the honest body error on a non-403 failure, never the no-access notice', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/email-log') return { data: { data: [EMAIL_ROW] } }
      throw new Error('body boom')
    })
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole('button'))
    await waitFor(() => expect(screen.getByText(i18n.t('opportunities:email.body.error'))).toBeInTheDocument())
    expect(screen.queryByText(i18n.t('opportunities:email.body.noAccess'))).not.toBeInTheDocument()
  })
})
