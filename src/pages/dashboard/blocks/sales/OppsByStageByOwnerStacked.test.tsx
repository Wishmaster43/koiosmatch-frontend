/**
 * OppsByStageByOwnerStacked — asserts the stacked series union, the unassigned
 * label mapping, and that a bar click navigates by stage + owner id (stage
 * only for the synthetic 'none'/unassigned series).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import OppsByStageByOwnerStacked from './OppsByStageByOwnerStacked'
import type { OppsByStageByOwnerRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let captured: { onBarClick?: (row: unknown, series: unknown) => void; data?: unknown[]; series?: unknown[] } = {}
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="bar" /> },
}))

const rows: OppsByStageByOwnerRow[] = [
  { stage_id: 's1', stage_label: 'Qualified', by_owner: [{ owner_id: '7', name: 'Alice', count: 3 }, { owner_id: null, name: 'x', count: 1 }, { owner_id: '9', name: '', count: 2 }] },
  { stage_id: 's2', stage_label: 'Won', by_owner: [{ owner_id: '7', name: 'Alice', count: 2 }] },
]

describe('OppsByStageByOwnerStacked', () => {
  it('builds one series per owner (unassigned mapped) and one row per stage', () => {
    render(<OppsByStageByOwnerStacked rows={rows} onNavigate={vi.fn()} />)
    expect(captured.series).toHaveLength(3)
    expect(captured.data).toHaveLength(2)
    expect((captured.data![0] as Record<string, unknown>).name).toBe('Qualified')
    // The null-owner row (name: 'x') must map to the unassigned label, never the raw name.
    const labels = (captured.series as { key: string; label: string }[]).map(s => s.label)
    expect(labels).toContain('feed.unassigned')
    expect(labels).not.toContain('x')
    // An id-carrying owner with an empty name falls back to the unknown label.
    expect(labels).toContain('widget.unknown')
  })

  it('navigates to opportunities filtered by stage AND owner id for a real owner series', () => {
    const onNavigate = vi.fn()
    render(<OppsByStageByOwnerStacked rows={rows} onNavigate={onNavigate} />)
    captured.onBarClick?.({ stageId: 's2' }, { key: '7' })
    expect(onNavigate).toHaveBeenCalledWith('opportunities', { stage: 's2', owner: '7' })
  })

  it('navigates by stage only for the unassigned (none) series', () => {
    const onNavigate = vi.fn()
    render(<OppsByStageByOwnerStacked rows={rows} onNavigate={onNavigate} />)
    captured.onBarClick?.({ stageId: 's2' }, { key: 'none' })
    expect(onNavigate).toHaveBeenCalledWith('opportunities', { stage: 's2' })
  })
})
