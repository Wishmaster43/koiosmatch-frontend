import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidatesTable from './CandidatesTable'
import type { Candidate } from '@/types/candidate'

// Controlled lookup metas — flags drive the deep-link, never the label/slug
// (mirrors the sibling agents' contract). funnelTypes stays empty (sort order only).
const funnelMeta = vi.fn((v?: string) => (
  v === 'hired' ? { label: 'Aangenomen', color: '#000', is_match: true } : { label: 'Gesolliciteerd', color: '#000', is_match: false }
))
const statusMeta = vi.fn((v?: string) => (
  v === 'sick' ? { label: 'Ziek', color: '#000', requires_reason: true }
    : v === 'placed' ? { label: 'Geplaatst', color: '#000', requires_match: true }
    : { label: 'Beschikbaar', color: '#000' }
))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    funnelTypes: [],
    funnelMeta,
    statusMeta,
    phaseMeta: (v?: string) => ({ label: v ?? '', color: '#000' }),
    typeMeta: (v?: string) => ({ label: v ?? '', color: '#000' }),
  }),
}))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ colorOf: () => null }) }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ labelOf: (v: string) => v, iconOf: () => null }) }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  // Colour flags on so chip branches render (matches the coloured production default for status/phase).
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
// Shared advice resolver (contract D) — stubbed stable so the koios column renders without a real hook.
vi.mock('@/lib/useCandidateAdvice', () => ({ useCandidateAdvice: () => () => null }))

const baseCandidate: Candidate = {
  id: 1, name: 'Jane Doe', initials: 'JD', title: 'Nurse', city: 'Utrecht',
  phase: null, status: null, created: '2026-01-01', lastContactAt: null, lastContactType: null,
  lastContactBy: null, stage: '', stageLabel: null, stageColor: null,
  candidateTypes: [], pools: [], koiosAdvice: null, owner: 'Owner', ownerInitials: '?', ownerColor: null,
  gender: null, lifecycle: 'active',
} as unknown as Candidate

describe('CandidatesTable cell deep-links', () => {
  it('clicking the talent pool chip opens work:pools and does not select the row', async () => {
    const onOpenTab = vi.fn()
    const onSelect = vi.fn()
    const row = { ...baseCandidate, pools: [{ id: 'p1', name: 'Pool A', color: '#111' }] }
    render(<CandidatesTable rows={[row]} onOpenTab={onOpenTab} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /talentenpools/i }))
    expect(onOpenTab).toHaveBeenCalledWith(row, 'work:pools')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('a stage carrying is_match sends work:matches, a plain stage sends work:applications', async () => {
    const onOpenTab = vi.fn()
    const hired = { ...baseCandidate, id: 2, stage: 'hired' }
    const applied = { ...baseCandidate, id: 3, stage: 'applied' }
    render(<CandidatesTable rows={[hired, applied]} onOpenTab={onOpenTab} />)
    await userEvent.click(screen.getByRole('button', { name: /matches/i }))
    expect(onOpenTab).toHaveBeenCalledWith(hired, 'work:matches')
    await userEvent.click(screen.getByRole('button', { name: /sollicitaties/i }))
    expect(onOpenTab).toHaveBeenCalledWith(applied, 'work:applications')
  })

  it('a status carrying requires_reason sends preferences', async () => {
    const onOpenTab = vi.fn()
    const row = { ...baseCandidate, id: 4, status: 'sick' }
    render(<CandidatesTable rows={[row]} onOpenTab={onOpenTab} />)
    await userEvent.click(screen.getByRole('button', { name: /voorkeuren/i }))
    expect(onOpenTab).toHaveBeenCalledWith(row, 'preferences')
  })

  it('a status with no flags renders no deep-link button', () => {
    const row = { ...baseCandidate, id: 5, status: 'available' }
    render(<CandidatesTable rows={[row]} />)
    expect(screen.queryByRole('button', { name: /matches/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /voorkeuren/i })).toBeNull()
  })
})
