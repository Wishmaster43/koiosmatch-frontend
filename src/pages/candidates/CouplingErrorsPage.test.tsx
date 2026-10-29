/**
 * CouplingErrorsPage — the deep-link destination behind the dashboard
 * coupling_errors KPI (K-173 fase 5). Covers the four UI states + the
 * entity_type → drilldown link mapping.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import { NavigationProvider } from '@/context/NavigationContext'
import CouplingErrorsPage from './CouplingErrorsPage'
import { useCouplingErrors } from './hooks/useCouplingErrors'
import type { CouplingErrorRow } from './hooks/useCouplingErrors'

// Data layer under test control, same convention as RunsTable.test.tsx.
vi.mock('./hooks/useCouplingErrors', () => ({ useCouplingErrors: vi.fn() }))
const mockedUseCouplingErrors = vi.mocked(useCouplingErrors)

afterEach(() => vi.clearAllMocks())

const renderPage = () => {
  const goTo = vi.fn()
  render(<NavigationProvider goTo={goTo}><CouplingErrorsPage /></NavigationProvider>)
  return { goTo }
}

const row: CouplingErrorRow = {
  entity_type: 'candidate', entity_id: 'c-1', entity_label: 'Jan de Vries',
  system: 'shiftmanager', error: 'GUID not found upstream', synced_at: '2026-08-20T14:30:00Z',
}

describe('CouplingErrorsPage — four UI states', () => {
  it('loading state', () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [], loading: true, error: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('Koppelfouten laden…')).toBeInTheDocument()
  })

  it('error state renders ErrorBanner, never the loading/empty text', () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [], loading: false, error: true, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('De koppelfouten konden niet worden geladen.')
  })

  it('empty state — no rows, no error', () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('Geen koppelfouten. Elke koppeling is succesvol gesynchroniseerd.')).toBeInTheDocument()
  })

  it('success state renders a row with its reason and system chip', () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [row], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument()
    expect(screen.getByText('GUID not found upstream')).toBeInTheDocument()
    expect(screen.getByText('Shiftmanager')).toBeInTheDocument()
  })
})

describe('CouplingErrorsPage — entity_type → drilldown link mapping', () => {
  it('a known entity_type (candidate) opens its own drilldown via EntityLink', async () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [row], loading: false, error: false, refetch: vi.fn() })
    const { goTo } = renderPage()
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.setup().click(screen.getByText('Jan de Vries'))
    expect(goTo).toHaveBeenCalledWith('candidates', { open: 'c-1', tab: undefined })
  })

  it('an unmapped entity_type falls back to plain text, never a link to nowhere', () => {
    mockedUseCouplingErrors.mockReturnValue({
      rows: [{ ...row, entity_type: 'unknown_thing', entity_label: 'Mystery record' }],
      loading: false, error: false, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('Mystery record')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mystery record' })).not.toBeInTheDocument()
  })
})

// ONIX K-013 (BE lane D f0855053): open downstream-erasure requests ride the same feed.
describe('CouplingErrorsPage — downstream-erasure rows', () => {
  it('renders an erasure_candidate row as plain text with its status as text, never a link or a raw code', async () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [{ entity_type: 'erasure_candidate', entity_id: 'req-9', entity_label: 'Verwijderde kandidaat',
      system: 'webhook', error: 'manual_required', synced_at: null }], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(await screen.findByText('Verwijderde kandidaat')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    // The real nl bundle renders here (the file's other cases assert 'Shiftmanager' the same way).
    expect(screen.getByText('Wisverzoek vraagt handmatige afhandeling')).toBeInTheDocument()
    expect(screen.queryByText('manual_required')).toBeNull()
  })

  it('renders an erasure_contact row as plain text, never a link', async () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [{ entity_type: 'erasure_contact', entity_id: 'req-10', entity_label: 'Verwijderd contact',
      system: 'webhook', error: 'pending', synced_at: null }], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(await screen.findByText('Verwijderd contact')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Wisverzoek wacht op bevestiging van het ontvangende systeem')).toBeInTheDocument()
  })

  it('renders the translated sentence for a failed erasure status', async () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [{ entity_type: 'erasure_candidate', entity_id: 'req-11', entity_label: 'Kandidaat X',
      system: 'webhook', error: 'failed', synced_at: null }], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(await screen.findByText('Wisverzoek is mislukt')).toBeInTheDocument()
  })

  it('shows an unknown erasure status as plain text without crashing', async () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [{ entity_type: 'erasure_candidate', entity_id: 'req-12', entity_label: 'Kandidaat Y',
      system: 'webhook', error: 'zzz_new', synced_at: null }], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(await screen.findByText('zzz_new')).toBeInTheDocument()
  })

  it('renders the subtitle covering both row kinds', async () => {
    mockedUseCouplingErrors.mockReturnValue({ rows: [], loading: false, error: false, refetch: vi.fn() })
    renderPage()
    expect(await screen.findByText(/wisverzoeken die een ontvangend systeem nog niet heeft bevestigd/)).toBeInTheDocument()
  })
})
