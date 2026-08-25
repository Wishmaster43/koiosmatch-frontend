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

  it('renders nothing when dash is null', () => {
    const { container } = render(
      <FeedTileGrid dash={null} vis={() => true} hasPlanning={false} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
