/**
 * MatchesByContractTypeDonut — asserts slices render from the exact server
 * shape, zero-count slices drop, and a slice click drills broadly to matches.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import MatchesByContractTypeDonut from './MatchesByContractTypeDonut'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { MatchesByContractTypeRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

// Capture PieChartCard props instead of rendering recharts (jsdom has no layout engine).
vi.mock('@/components/charts/PieChartCard', () => ({
  default: (props: { data: { name: string; value: number }[]; onItemClick?: () => void }) => (
    <div data-testid="pie" data-data={JSON.stringify(props.data)} onClick={() => props.onItemClick?.()} />
  ),
}))

// Fixture DATA (server-supplied lookup colour), not UI styling.
const rows: MatchesByContractTypeRow[] = [
  // A colour outside CHART_SERIES_COLORS keeps this row's colour distinguishable
  // from the palette-fallback path used by the 'Flex' row below.
  // eslint-disable-next-line no-restricted-syntax -- fixture DATA
  { value: 'zzp', label: 'ZZP', color: '#123456', count: 5 },
  { value: 'flex', label: 'Flex', color: null, count: 3 },
  { value: 'none', label: 'Unknown', color: null, count: 0 },
]

describe('MatchesByContractTypeDonut', () => {
  it('renders slices from the server shape, dropping zero-count and using widget.unknown for value=none', () => {
    const { getByTestId } = render(<MatchesByContractTypeDonut rows={rows} onNavigate={vi.fn()} />)
    const data = JSON.parse(getByTestId('pie').dataset.data!)
    // Expected VALUE mirrors the fixture DATA above, not UI styling.
    expect(data).toEqual([
      // eslint-disable-next-line no-restricted-syntax -- fixture DATA
      { name: 'ZZP', value: 5, color: '#123456' },
      // Flex has no server colour: resolves to the palette fallback, not the ZZP row's colour.
      { name: 'Flex', value: 3, color: CHART_SERIES_COLORS[1] },
    ])
  })

  it('drills broadly to matches on slice click (no contract-type intent exists)', () => {
    const onNavigate = vi.fn()
    const { getByTestId } = render(<MatchesByContractTypeDonut rows={rows} onNavigate={onNavigate} />)
    getByTestId('pie').click()
    expect(onNavigate).toHaveBeenCalledWith('matches')
  })

  it('self-hides when every row is zero-count', () => {
    const { container } = render(<MatchesByContractTypeDonut rows={[{ value: 'zzp', label: 'ZZP', color: null, count: 0 }]} onNavigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
