/**
 * drillClick — the shared segment/owner click handlers resolve the clicked datum to
 * the segment and open the drill with the axis param, exactly as every report did.
 */
import { describe, it, expect, vi } from 'vitest'
import { segmentClick, ownerClick } from './drillClick'

const segs = [
  { value: 'open', label: 'Open', count: 3 },
  { value: 'closed', label: 'Closed', count: 1 },
]

describe('segmentClick', () => {
  it('finds the segment by the datum key and opens { [axis]: value }', () => {
    const open = vi.fn()
    segmentClick(segs, 'status', open)({ key: 'closed', name: 'Closed', value: 1 })
    expect(open).toHaveBeenCalledWith(segs[1], { status: 'closed' })
  })

  it('reads the key from a Recharts payload wrapper too', () => {
    const open = vi.fn()
    segmentClick(segs, 'status', open)({ payload: { key: 'open' } })
    expect(open).toHaveBeenCalledWith(segs[0], { status: 'open' })
  })

  it('ignores a datum whose key matches no segment', () => {
    const open = vi.fn()
    segmentClick(segs, 'status', open)({ key: 'gone' })
    expect(open).not.toHaveBeenCalled()
  })
})

describe('ownerClick', () => {
  const owners = [{ owner_id: 'u1', name: 'Ada', count: 4 }]

  it('opens the owner drill with the name as label and the id as param', () => {
    const open = vi.fn()
    ownerClick(owners, open)({ key: 'u1' })
    expect(open).toHaveBeenCalledWith({ label: 'Ada', count: 4 }, { owner: 'u1' })
  })

  it('uses the given param name (assignee axes)', () => {
    const open = vi.fn()
    ownerClick(owners, open, 'assignee')({ key: 'u1' })
    expect(open).toHaveBeenCalledWith({ label: 'Ada', count: 4 }, { assignee: 'u1' })
  })
})
