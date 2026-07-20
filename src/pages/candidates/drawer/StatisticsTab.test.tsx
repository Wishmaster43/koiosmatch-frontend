/**
 * StatisticsTab — CREATED-BY-SOURCE-1 (Danny: "wil ik ook zien aangemaakt door
 * wie en de bron"): the overview card gains two rows, each falling back to an
 * italic muted em-dash (§4) when the value is unset (legacy rows).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatisticsTab from './StatisticsTab'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ statusMeta: () => ({ label: '' }) }) }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ labelOf: (v: string) => v }) }))

const baseCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, matches: [], applications: [], branches: [], ...overrides } as unknown as Candidate)

describe('StatisticsTab · createdBy / source rows', () => {
  it('shows the creator name and the acquisition source when present', () => {
    render(<StatisticsTab c={baseCandidate({ createdBy: { id: 7, name: 'Bente de Jong' }, source: 'indeed' })} />)
    expect(screen.getByText('Bente de Jong')).toBeInTheDocument()
    expect(screen.getByText('indeed')).toBeInTheDocument()
  })

  it('renders an italic em-dash for a legacy row without a creator/source', () => {
    render(<StatisticsTab c={baseCandidate({ createdBy: null, source: null })} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
    dashes.forEach(el => expect(el).toHaveStyle({ fontStyle: 'italic' }))
  })
})
