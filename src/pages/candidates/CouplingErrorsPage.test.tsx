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
