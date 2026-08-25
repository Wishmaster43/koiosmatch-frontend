/**
 * OpportunitiesInsightsRow · owner donut id regression (OPP-OWNER-ID-1).
 *
 * The owner filter now keys on ownerId (§ OPP-OWNER-ID-1), so this covers the
 * seam a page-level render can't isolate cheaply: (a) picking a donut segment
 * must hand the OWNER ID back to onPickOwner (never the display name — a name
 * pushed into an id-keyed filter empties the list, the regression this test
 * guards), and (b) the visible/aria-facing `picked` label must resolve back
 * to the owner's NAME, never leak the raw id into the UI.
 *
 * The shared InsightsRow is mocked to a thin capture shim so this test proves
 * the donut CONFIG this component builds, without depending on recharts/jsdom
 * pointer mechanics (mirrors the barrel-mocking guidance in CLAUDE.md §2).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import OpportunitiesInsightsRow from './OpportunitiesInsightsRow'
import type { Opportunity } from '@/types/opportunity'

// Capture the donuts InsightsRow receives instead of rendering the real charts.
let capturedDonuts: DonutSpec[] = []
vi.mock('@/components/insights/InsightsRow', () => ({
  default: (props: { donuts: DonutSpec[]; kpis: KpiSpec[] }) => {
    capturedDonuts = props.donuts
    return null
  },
}))

const rows: Partial<Opportunity>[] = [
  { id: 'o1', owner: 'Alice', ownerId: 'u1', stage: 'Lead', stageValue: 'lead', client: 'Klant A', value: 100, hours: null, dealTypeUnit: null },
  { id: 'o2', owner: 'Bob', ownerId: 'u2', stage: 'Lead', stageValue: 'lead', client: 'Klant B', value: 200, hours: null, dealTypeUnit: null },
]

const noop = () => {}

describe('OpportunitiesInsightsRow · owner donut keys on id (OPP-OWNER-ID-1)', () => {
  it('a segment click hands the owner ID to onPickOwner, not the display name', () => {
    const onPickOwner = vi.fn()
    render(
      <OpportunitiesInsightsRow
        rows={rows as Opportunity[]} stages={[]} valueInHours={false}
        stage={[]} owner={[]} client={[]}
        onPickStage={noop} onClearStage={noop}
        onPickOwner={onPickOwner} onClearOwner={noop}
        onPickClient={noop} onClearClient={noop}
        onSetStageFilter={noop}
      />,
    )
    const ownerDonut = capturedDonuts.find(d => d.key === 'owner')
    // The segment for Alice carries key=ownerId, name=owner label.
    const aliceSegment = ownerDonut?.data.find((d) => (d as { name: string }).name === 'Alice') as { key: string } | undefined
    expect(aliceSegment?.key).toBe('u1')
    // Simulate what MiniDonut hands onPick — the raw segment.
    ownerDonut?.onPick?.(aliceSegment)
    expect(onPickOwner).toHaveBeenCalledWith(aliceSegment)
  })

  it('resolves the picked owner id back to the display name for the visible chip', () => {
    render(
      <OpportunitiesInsightsRow
        rows={rows as Opportunity[]} stages={[]} valueInHours={false}
        stage={[]} owner={['u1']} client={[]}
        onPickStage={noop} onClearStage={noop}
        onPickOwner={noop} onClearOwner={noop}
        onPickClient={noop} onClearClient={noop}
        onSetStageFilter={noop}
      />,
    )
    const ownerDonut = capturedDonuts.find(d => d.key === 'owner')
    // The chip/aria-label facing text must be the NAME, never the raw uuid.
    expect(ownerDonut?.picked).toBe('Alice')
    expect(ownerDonut?.active).toBe(true)
  })
})
