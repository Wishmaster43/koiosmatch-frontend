import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancyLeadsPanel from './VacancyLeadsPanel'
import type { VacancyLeadRow } from './hooks/useVacancyLeads'

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))

const hasPermission = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission }) }))

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}))

// Mock useTranslation for the new i18n keys that aren't in locale files yet.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'leadsExpand.recountBtn': 'Suggesties vernieuwen',
          'leadsExpand.recountQueued': 'In de wachtrij gezet, de lijst ververst binnen enkele minuten',
          'leadsExpand.recountThrottled': 'Even wachten, net al aangevraagd',
          'leadsExpand.recountFailed': 'Vernieuwen is mislukt',
          'leadsExpand.loading': 'Leads laden…',
          'leadsExpand.empty': 'Geen leads gevonden.',
          'leadsExpand.error': 'Leads konden niet worden geladen.',
          'leadsExpand.colName': 'Naam',
          'leadsExpand.colPhase': 'Fase',
          'leadsExpand.colSource': 'Bron',
          'leadsExpand.colCreated': 'Aangemaakt',
        }
        return translations[key] ?? key
      },
    }),
  }
})

// Mock the lookups — phase labels and source labels resolve via the mocks.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    phaseMeta: (v?: string) => {
      const meta: Record<string, { label: string; color: string }> = {
        'lead': { label: 'Lead', color: '#999' },
        'candidate': { label: 'Candidate', color: '#999' },
      }
      return meta[v ?? ''] ?? { label: v ?? '', color: '#999' }
    },
  }),
}))

// Mock seedLabel to resolve source slugs to readable labels.
vi.mock('@/lib/useSeedLabel', () => ({
  useSeedLabel: () => (namespace: string, options: { label?: string }) => {
    if (namespace === 'candidateSources') {
      const sources: Record<string, string> = {
        'website': 'Website',
        'referral': 'Referral',
        'linkedin': 'LinkedIn',
      }
      return sources[options.label ?? ''] ?? options.label
    }
    return options.label
  },
}))

// Mock the useVacancyLeads and useRecountVacancyLeads hooks.
const mockLeads = vi.fn()
const mockRecountMutate = vi.fn()
vi.mock('./hooks/useVacancyLeads', () => ({
  useVacancyLeads: (vacancyId: unknown, enabled: unknown) => mockLeads(vacancyId, enabled),
  useRecountVacancyLeads: () => ({ mutate: mockRecountMutate }),
}))

// Mock the date formatter.
vi.mock('@/lib/datetime', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/datetime')>()
  return {
    ...actual,
    useDateFormat: () => ({
      locale: 'nl-NL',
      formatDate: (d: unknown) => (d == null ? '—' : String(d)),
    }),
  }
})

const baseLeadRow: VacancyLeadRow = {
  id: 'c1',
  name: 'Jane Doe',
  phase: 'candidate',
  source: 'website',
  createdAt: '2026-01-15',
}

describe('VacancyLeadsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasPermission.mockReturnValue(false) // Default is no permission; tests explicitly grant it.
  })

  it('renders loading state', () => {
    mockLeads.mockReturnValue({ rows: [], loading: true, error: null })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)
    expect(screen.getByText('Leads laden…')).toBeInTheDocument()
  })

  it('renders error state with an alert role', () => {
    mockLeads.mockReturnValue({ rows: [], loading: false, error: new Error('failed') })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Leads konden niet worden geladen.')
  })

  it('renders empty state when no leads are returned', () => {
    mockLeads.mockReturnValue({ rows: [], loading: false, error: null })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)
    expect(screen.getByText('Geen leads gevonden.')).toBeInTheDocument()
  })

  it('renders lead rows with resolved phase and source labels', () => {
    const leads: VacancyLeadRow[] = [
      { ...baseLeadRow, id: 'c1', phase: 'candidate', source: 'website' },
      { ...baseLeadRow, id: 'c2', name: 'Bob Smith', phase: 'lead', source: 'referral' },
    ]
    mockLeads.mockReturnValue({ rows: leads, loading: false, error: null })
    render(<VacancyLeadsPanel vacancyId="v1" />)

    // Assert row 1: phase and source are resolved to labels, not raw slugs.
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Candidate')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()

    // Assert row 2: second row's different labels.
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByText('Referral')).toBeInTheDocument()
  })

  it('renders em dashes for null phase and source values', () => {
    const leads: VacancyLeadRow[] = [
      { ...baseLeadRow, phase: null, source: null },
    ]
    mockLeads.mockReturnValue({ rows: leads, loading: false, error: null })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)

    // Two dashes for phase and source cells; one more for other cells.
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('clicking a lead row calls openEntity with the candidate id, not the table row callback', async () => {
    const user = userEvent.setup()
    const leads: VacancyLeadRow[] = [baseLeadRow]
    mockLeads.mockReturnValue({ rows: leads, loading: false, error: null })
    const { container } = render(<VacancyLeadsPanel vacancyId={'v1'} />)

    // Click the row (DataTable's onRowClick handler).
    const row = container.querySelector('tbody tr')
    expect(row).toBeTruthy()
    await user.click(row!)

    // Assert openEntity was called with 'candidates' and the lead's id.
    expect(openEntity).toHaveBeenCalledWith('candidates', baseLeadRow.id)
  })

  it('formats the createdAt date via useDateFormat', () => {
    const leads: VacancyLeadRow[] = [
      { ...baseLeadRow, createdAt: '2026-01-15' },
      { ...baseLeadRow, id: 'c2', createdAt: null },
    ]
    mockLeads.mockReturnValue({ rows: leads, loading: false, error: null })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)

    // useDateFormat mock returns the raw date string; createdAt is displayed as-is.
    expect(screen.getByText('2026-01-15')).toBeInTheDocument()
  })

  it('renders the recount button when hasPermission returns true', () => {
    hasPermission.mockReturnValue(true)
    mockLeads.mockReturnValue({ rows: [], loading: false, error: null })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)

    expect(screen.getByRole('button', { name: /Suggesties vernieuwen/i })).toBeInTheDocument()
  })

  it('hides the recount button when hasPermission returns false (no fake affordances)', () => {
    hasPermission.mockReturnValue(false)
    mockLeads.mockReturnValue({ rows: [], loading: false, error: null })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)

    expect(screen.queryByRole('button', { name: /Suggesties vernieuwen/i })).not.toBeInTheDocument()
  })

  it('clicking recount button POSTs to the leads/recount endpoint and shows a queued message', async () => {
    const { notifySuccess } = await import('@/lib/notify')
    const user = userEvent.setup()
    hasPermission.mockReturnValue(true)
    mockLeads.mockReturnValue({ rows: [], loading: false, error: null })
    mockRecountMutate.mockResolvedValueOnce({ status: 'queued' })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)

    const btn = screen.getByRole('button', { name: /Suggesties vernieuwen/i })
    await user.click(btn)

    await waitFor(() => {
      expect(mockRecountMutate).toHaveBeenCalledWith('v1')
      expect(vi.mocked(notifySuccess)).toHaveBeenCalled()
    })
  })

  it('recount button handles 429 throttle response', async () => {
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    hasPermission.mockReturnValue(true)
    mockLeads.mockReturnValue({ rows: [], loading: false, error: null })
    mockRecountMutate.mockRejectedValueOnce({ response: { status: 429 } })
    render(<VacancyLeadsPanel vacancyId={'v1'} />)

    const btn = screen.getByRole('button', { name: /Suggesties vernieuwen/i })
    await user.click(btn)

    await waitFor(() => {
      expect(vi.mocked(notifyError)).toHaveBeenCalled()
    })
  })
})
