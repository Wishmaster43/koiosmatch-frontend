/**
 * PoolsSection — LOOKUP-ICON-1 coverage: a pool's tenant `icon` (lucide slug or
 * emoji) rides next to its swatch dot/name, both in the membership chips card
 * and the add dropdown — never replacing the colour swatch (§6, icon is
 * additive, not the only signal).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PoolsSection from './PoolsSection'
import type { Candidate } from '@/types/candidate'

// useCandidatePools's own hook GETs the tenant /pools list — stubbed here so
// PoolsSection only exercises its own rendering (mirrors useCandidatePools.test.ts).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), delete: vi.fn() } }
})

const candidateWithPool = (extra: Record<string, unknown>): Candidate =>
  ({ id: 'c1', pools: [{ id: 'p1', name: 'ICU', color: '#79B58E', ...extra }] } as unknown as Candidate)

describe('PoolsSection · pool icon (LOOKUP-ICON-1)', () => {
  it('shows the pool\'s tenant icon next to its chip label', () => {
    render(<PoolsSection c={candidateWithPool({ icon: 'star' })} />)
    const chip = screen.getByText('ICU').closest('span')
    expect(chip?.querySelector('svg')).toBeInTheDocument()
  })

  it('renders no icon element when the pool carries none (no fake affordance)', () => {
    render(<PoolsSection c={candidateWithPool({})} />)
    const chip = screen.getByText('ICU').closest('span')
    expect(chip?.querySelector('svg')).toBeNull()
  })
})
