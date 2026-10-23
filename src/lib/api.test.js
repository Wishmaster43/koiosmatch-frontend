import { describe, it, expect, vi } from 'vitest'
import api, { unwrap, unwrapList } from './api'
import { TENANT_PICK_FLAG, TENANT_PICK_CODE_KEY, TENANT_REQUIRED_EVENT } from './tenantResolution'

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

  it('reads the server row range (meta.from/to) and nulls it when absent', () => {
    const r = unwrapList(res({ data: [{ id: 1 }], meta: { total: 104, current_page: 2, last_page: 2, per_page: 100, from: 101, to: 104 } }))
    expect(r.from).toBe(101)
    expect(r.to).toBe(104)
    const bare = unwrapList(res([1, 2]))
    expect([bare.from, bare.to]).toEqual([1, 2])
    const empty = unwrapList(res({ data: [], meta: { total: 0, from: null, to: null } }))
    expect([empty.from, empty.to]).toEqual([null, null])
    expect(unwrapList(res({})).from).toBeNull()
  })

  it('defaults gracefully on an empty/garbage body', () => {
    const r = unwrapList(res({}))
    expect(r.rows).toEqual([])
    expect(r.total).toBe(0)
    expect(r.lastPage).toBe(1)
  })
})

// BE lane F B-002: a 409 tenant_not_ready raises the picker event once, carrying its code.
describe('response interceptor tenant_not_ready', () => {
  it('dispatches TENANT_REQUIRED_EVENT once with detail.code tenant_not_ready', async () => {
    sessionStorage.removeItem(TENANT_PICK_FLAG)
    const onEvent = vi.fn()
    window.addEventListener(TENANT_REQUIRED_EVENT, onEvent)
    const rejected = api.interceptors.response.handlers.find(h => h && h.rejected).rejected
    const err = () => ({ config: { url: '/vacancies' }, response: { status: 409, data: { code: 'tenant_not_ready' } } })
    await rejected(err()).catch(() => {})
    await rejected(err()).catch(() => {})
    window.removeEventListener(TENANT_REQUIRED_EVENT, onEvent)
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent.mock.calls[0][0].detail.code).toBe('tenant_not_ready')
    expect(sessionStorage.getItem(TENANT_PICK_CODE_KEY)).toBe('tenant_not_ready')
    sessionStorage.removeItem(TENANT_PICK_FLAG)
    sessionStorage.removeItem(TENANT_PICK_CODE_KEY)
  })
})
