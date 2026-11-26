/**
 * whatsappTextTemplatesApi: REQUEST-ASSERT-1 pins of method, route and body on the adapter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import {
  WHATSAPP_TEXT_TEMPLATES_ROUTE, listWhatsappTextTemplates, createWhatsappTextTemplate,
  updateWhatsappTextTemplate, deleteWhatsappTextTemplate,
} from './whatsappTextTemplatesApi'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/idempotency', () => ({ withIdempotencyKey: (cfg?: Record<string, unknown>) => ({ ...(cfg ?? {}), headers: { 'Idempotency-Key': 'k' } }) }))

const mocked = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
const row = { id: 't1', name: 'Intro', body: 'Hoi {{first_name}}', language: 'nl', is_active: true }
const input = { name: 'Intro', body: 'Hoi {{first_name}}', language: 'nl', is_active: true }

beforeEach(() => { vi.clearAllMocks() })

describe('whatsappTextTemplatesApi', () => {
  it('lists with GET on the route, unwraps the data envelope and reads meta.placeholders', async () => {
    mocked.get.mockResolvedValueOnce({ data: { data: [row], meta: { placeholders: ['first_name', 'owner_name'] } } })
    const list = await listWhatsappTextTemplates()
    expect(mocked.get).toHaveBeenCalledWith(WHATSAPP_TEXT_TEMPLATES_ROUTE, { signal: undefined, quietStatuses: [403, 404] })
    expect(list).toEqual({ rows: [row], placeholders: ['first_name', 'owner_name'] })
  })

  it('an empty bureau still carries its placeholders; a missing meta yields an empty list', async () => {
    mocked.get.mockResolvedValueOnce({ data: { data: [], meta: { placeholders: ['first_name'] } } })
    expect(await listWhatsappTextTemplates()).toEqual({ rows: [], placeholders: ['first_name'] })
    mocked.get.mockResolvedValueOnce({ data: { data: [row] } })
    expect(await listWhatsappTextTemplates()).toEqual({ rows: [row], placeholders: [] })
  })

  it('creates with POST, the input as body, an idempotency key and the 422 kept quiet', async () => {
    mocked.post.mockResolvedValueOnce({ data: { data: row } })
    const created = await createWhatsappTextTemplate(input)
    expect(mocked.post).toHaveBeenCalledWith(WHATSAPP_TEXT_TEMPLATES_ROUTE, input, { quietStatuses: [422], headers: { 'Idempotency-Key': 'k' } })
    expect(created).toEqual(row)
  })

  it('updates with PUT on /{id} and the input as body', async () => {
    mocked.put.mockResolvedValueOnce({ data: { data: { ...row, name: 'Intro 2' } } })
    const updated = await updateWhatsappTextTemplate('t1', { ...input, name: 'Intro 2' })
    expect(mocked.put).toHaveBeenCalledWith(`${WHATSAPP_TEXT_TEMPLATES_ROUTE}/t1`, { ...input, name: 'Intro 2' }, { quietStatuses: [422] })
    expect(updated.name).toBe('Intro 2')
  })

  it('deletes with DELETE on /{id}', async () => {
    mocked.delete.mockResolvedValueOnce({ status: 204 })
    await deleteWhatsappTextTemplate('t1')
    expect(mocked.delete).toHaveBeenCalledWith(`${WHATSAPP_TEXT_TEMPLATES_ROUTE}/t1`)
  })
})
