import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancyLeadsPanel from './VacancyLeadsPanel'
import type { VacancyLeadRow } from './hooks/useVacancyLeads'

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))

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

// Mock the useVacancyLeads hook to return stable test data.
const mockLeads = vi.fn()
vi.mock('./hooks/useVacancyLeads', () => ({
  useVacancyLeads: (vacancyId: unknown, enabled: unknown) => mockLeads(vacancyId, enabled),
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
})
