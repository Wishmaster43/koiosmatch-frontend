import { describe, it, expect } from 'vitest'
import { unwrap, unwrapList } from './api'

// Helper: fake an axios response (the helpers read `res.data`).
const res = (data) => ({ data })

describe('unwrap', () => {
  it('unwraps a { data } Resource to its payload', () => {
    expect(unwrap(res({ data: { id: 1, name: 'A' } }))).toEqual({ id: 1, name: 'A' })
  })

  it('returns a bare object as-is', () => {
    expect(unwrap(res({ id: 2 }))).toEqual({ id: 2 })
  })
})

describe('unwrapList', () => {
  it('handles a bare array (response()->json($models))', () => {
    const r = unwrapList(res([1, 2, 3]))
    expect(r.rows).toEqual([1, 2, 3])
    expect(r.total).toBe(3)
    expect(r.lastPage).toBe(1)
  })

  it('handles { data, meta } Resources', () => {
    const r = unwrapList(res({ data: [{ id: 1 }], meta: { total: 50, current_page: 2, last_page: 5, per_page: 10 } }))
    expect(r.rows).toEqual([{ id: 1 }])
    expect(r.total).toBe(50)
    expect(r.page).toBe(2)
    expect(r.lastPage).toBe(5)
    expect(r.perPage).toBe(10)
  })

  it('handles the custom /reports paginatie shape (meta at top level)', () => {
    const r = unwrapList(res({ data: [{ id: 1 }, { id: 2 }], total: 2, per_page: 25, current_page: 1, last_page: 1 }))
    expect(r.rows).toHaveLength(2)
    expect(r.total).toBe(2)
    expect(r.perPage).toBe(25)
  })

  it('defaults gracefully on an empty/garbage body', () => {
    const r = unwrapList(res({}))
    expect(r.rows).toEqual([])
    expect(r.total).toBe(0)
    expect(r.lastPage).toBe(1)
  })
})
