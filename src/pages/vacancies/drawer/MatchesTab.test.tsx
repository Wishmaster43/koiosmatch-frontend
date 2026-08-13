/**
 * MatchesTab (vacancy drawer) — V-table-2: read-only, four explicit UI states.
 * The GET-request shape itself is covered by useVacancyMatches.test.ts; this
 * file proves the tab renders the fetched rows and never offers an edit/add
 * affordance (a match's fields are opened/edited from the candidate/customer
 * side, never here — mirrors the candidate/customer drawer's own MatchesTab).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import MatchesTab from './MatchesTab'
import type { MatchRow } from '@/types/match'

// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const statuses = [{ value: 'open', label: 'Open', color: '#123456', is_closed: false }]
const metaOf = (v?: string) => statuses.find(s => s.value === v)
const mockUseMatchStatuses = () => ({ statuses, metaOf })
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => mockUseMatchStatuses() }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: () => false }) }))

const state: { rows: MatchRow[]; loading: boolean; error: boolean } = { rows: [], loading: false, error: false }
vi.mock('../hooks/useVacancyMatches', () => ({ useVacancyMatches: () => state }))

const row = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: 'm-1', candidate: 'Rosa Tijssen', initials: 'RT', vacancy: 'Verpleegkundige', client: 'Yesway',
  candidateId: 'c-1', vacancyId: 'v-1', clientId: 'cl-1', score: 80, stage: 'Open', status: 'open',
  stageColor: '#123456', owner: 'Danny', ownerId: 'u-1', ownerInitials: 'DP', ownerColor: null, date: '2026-06-01',
  helloflexLink: null, shiftmanagerLink: null,
  ...over,
})

describe('MatchesTab (vacancy drawer) · four UI states', () => {
  it('loading', () => {
    state.rows = []; state.loading = true; state.error = false
    render(<MatchesTab vacancyId="v-1" />)
    expect(screen.getByText(/laden|loading/i)).toBeInTheDocument()
  })

  it('error', () => {
    state.rows = []; state.loading = false; state.error = true
    render(<MatchesTab vacancyId="v-1" />)
    expect(screen.getByText(/fout|niet worden geladen|error/i)).toBeInTheDocument()
  })

  it('empty', () => {
    state.rows = []; state.loading = false; state.error = false
    render(<MatchesTab vacancyId="v-1" />)
    expect(screen.getByText(/geen matches|no matches/i)).toBeInTheDocument()
  })

  it('success — renders the fetched match, read-only (no pencil/add affordance)', () => {
    state.rows = [row()]; state.loading = false; state.error = false
    render(<MatchesTab vacancyId="v-1" />)
    expect(screen.getByText('Rosa Tijssen')).toBeInTheDocument()
    // Never a "+ Match" trigger and never an edit pencil — a Match's own fields
    // are opened/edited from the candidate/customer side, not here.
    expect(screen.queryByRole('button', { name: /match toevoegen|nieuwe match/i })).toBeNull()
  })
})
