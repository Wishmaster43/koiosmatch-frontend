import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import { setLocationPrimaryContact, setDepartmentPrimaryContact, CONTACTS_CHANGED_EVENT, isPrimaryForLocation } from './contactPrimary'
import { splitContactName, quickContactPayload } from './contactPayload'

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { put: vi.fn() } }
})

beforeEach(() => vi.mocked(api.put).mockReset())

describe('setLocationPrimaryContact / setDepartmentPrimaryContact', () => {
  it('PUTs the location primary route, returns true and broadcasts when the flag landed', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'c1', locations: [{ id: 'l1', name: 'A', is_primary: true }] } } })
    const fired = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, fired)
    const applied = await setLocationPrimaryContact('k1', 'c1', 'l1')
    window.removeEventListener(CONTACTS_CHANGED_EVENT, fired)
    expect(api.put).toHaveBeenCalledWith('/customers/k1/contacts/c1/locations/l1/primary')
    expect(applied).toBe(true)
    expect(fired).toHaveBeenCalledTimes(1)
  })

  it('returns false and stays silent when the server left the flag unchanged', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'c1', departments: [{ id: 'd1', name: 'A', is_primary: false }] } } })
    const fired = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, fired)
    const applied = await setDepartmentPrimaryContact('k1', 'c1', 'd1')
    window.removeEventListener(CONTACTS_CHANGED_EVENT, fired)
    expect(api.put).toHaveBeenCalledWith('/customers/k1/contacts/c1/departments/d1/primary')
    expect(applied).toBe(false)
    expect(fired).not.toHaveBeenCalled()
  })

  it('reads no primary flag off a row that never came from the hook', () => {
    expect(isPrimaryForLocation({ id: 'c' } as never, 'l1')).toBe(false)
  })
})

describe('contactPayload helpers', () => {
  it('splits first word to firstName and the rest to lastName; a lone word is lastName', () => {
    expect(splitContactName('Jan van Dijk')).toEqual({ firstName: 'Jan', lastName: 'van Dijk' })
    expect(splitContactName('Dijk')).toEqual({ firstName: '', lastName: 'Dijk' })
  })

  it('builds the quick-create payload with the split name and empty links', () => {
    const p = quickContactPayload('Jan Dijk', 'j@x.nl', '012')
    expect(p).toMatchObject({ firstName: 'Jan', lastName: 'Dijk', email: 'j@x.nl', phone: '012', locationIds: [], departmentIds: [] })
  })
})
