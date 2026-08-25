/**
 * FeedTileGrid — proves the packed-grid contract: visible+has-data tiles render
 * in declaration order, a span-2 tile spans the full row, a hidden or empty tile
 * is skipped, and an empty result renders nothing.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { FeedTileEntry } from './feedRegistry'
import type { DashData } from '@/types/dashboard'
import FeedTileGrid from './FeedTileGrid'
import { renderedTileIds } from './feedTileKit'

// vi.mock's factory is hoisted above imports, so the fake tiles are built via
// vi.hoisted rather than a top-level const the factory would otherwise close over.
const { fakeTiles } = vi.hoisted(() => ({
  fakeTiles: [
    { blockId: 'block.a', feedKey: 'tasks_due_today', hasData: () => true, render: () => <div>Tile A</div> },
    { blockId: 'block.b', feedKey: 'redeploy_radar', span: 2, hasData: () => true, render: () => <div>Tile B</div> },
    { blockId: 'block.c', feedKey: 'documents_attention', hasData: () => false, render: () => <div>Tile C</div> },
  ] as FeedTileEntry[],
}))
vi.mock('./feedRegistry', () => ({ FEED_TILES: fakeTiles }))

describe('FeedTileGrid', () => {
  it('renders exactly the visible tiles with data, in declaration order, span-2 spanning the row', () => {
    const { container } = render(
      <FeedTileGrid dash={{} as DashData} vis={() => true} hasPlanning={false} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.style.display).toBe('grid')
    expect(grid.children).toHaveLength(2)
    expect(grid.textContent).toContain('Tile A')
    expect(grid.textContent).toContain('Tile B')
    expect(grid.textContent).not.toContain('Tile C')
    expect((grid.children[1] as HTMLElement).style.gridColumn).toBe('1 / -1')
  })

  it('hides a tile whose block id fails vis()', () => {
    const { container } = render(
      <FeedTileGrid dash={{} as DashData} vis={(id) => id !== 'block.a'} hasPlanning={false} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.textContent).not.toContain('Tile A')
    expect(grid.textContent).toContain('Tile B')
  })

  it('renders nothing when no tile qualifies', () => {
    const { container } = render(
      <FeedTileGrid dash={{} as DashData} vis={() => false} hasPlanning={false} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('treats a null dash as "no feed data": a feed tile reading its key hides, nothing renders', () => {
    const feedTile: FeedTileEntry = { blockId: 'block.g', feedKey: 'tasks_due_today', hasData: d => Array.isArray(d.tasks_due_today), render: () => <div>Tile G</div> }
    const { container } = render(
      <FeedTileGrid dash={null} vis={() => true} hasPlanning={false} entries={[feedTile]} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

// DASH-PAIRS-1 — a pair keeps its two tiles side by side whatever else hides.
describe('FeedTileGrid · pairs and exclusion', () => {
  const tileD: FeedTileEntry = { blockId: 'block.d', feedKey: 'recruiter_load', hasData: () => true, render: () => <div>Tile D</div> }
  const tileE = (has: boolean): FeedTileEntry => ({ blockId: 'block.e', feedKey: 'fill_rate_timeseries', hasData: () => has, render: () => <div>Tile E</div> })
  const pair = (has: boolean): FeedTileEntry => ({ blockId: 'pair.de', feedKey: 'recruiter_load', hasData: () => true, render: () => null, children: [tileD, tileE(has)] })
  const solo: FeedTileEntry = { blockId: 'block.f', feedKey: 'tasks_due_today', hasData: () => true, render: () => <div>Tile F</div> }

  it('renders both children of a pair in one full-width cell, side by side', () => {
    const { container } = render(
      <FeedTileGrid dash={{} as DashData} vis={() => true} hasPlanning={false} entries={[pair(true), solo]} />
    )
    const grid = container.firstElementChild as HTMLElement
    const cell = grid.children[0] as HTMLElement
    expect(cell.style.gridColumn).toBe('1 / -1')
    expect(cell.style.gridTemplateColumns).toBe('1fr 1fr')
    expect(cell.textContent).toBe('Tile DTile E')
    expect(grid.children).toHaveLength(2)
  })

  it('a lone pair child takes the whole cell (no hole beside it)', () => {
    const { container } = render(
      <FeedTileGrid dash={{} as DashData} vis={() => true} hasPlanning={false} entries={[pair(false)]} />
    )
    const cell = (container.firstElementChild as HTMLElement).children[0] as HTMLElement
    expect(cell.style.gridTemplateColumns).toBe('1fr')
    expect(cell.textContent).toBe('Tile D')
  })

  it('hides the pair entirely when neither child qualifies, and honours exclude', () => {
    const { container } = render(
      <FeedTileGrid dash={{} as DashData} vis={id => id !== 'block.d'} hasPlanning={false} entries={[pair(false), solo]} exclude={new Set(['block.f'])} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renderedTileIds lists the pair children, not the pair itself', () => {
    const ids = renderedTileIds([pair(true), solo], {} as DashData, () => true, { hasPlanning: false })
    expect([...ids]).toEqual(['block.d', 'block.e', 'block.f'])
  })
})
