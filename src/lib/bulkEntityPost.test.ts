import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bulkNotesPost, bulkArchivePost } from './bulkEntityPost'
import api from '@/lib/api'

// bulkEntityPost — the bulk "add note" / "archive" POST shape shared by the
// customers and vacancies bulk-action hooks. Mutation tests assert the exact
// REQUEST (route + body), never only that a callback fired (§13, DRY round 11).
vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }))

const t = (key: string, options?: Record<string, unknown>) => (options?.count != null ? `${key}:${options.count}` : key)

describe('bulkNotesPost', () => {
  beforeEach(() => { vi.mocked(api.post).mockReset() })

  it('posts the exact route and body for customers', () => {
    const setSelectedIds = vi.fn()
    const notify = vi.fn()
    vi.mocked(api.post).mockResolvedValue({ data: { updated: ['c1', 'c2'] } })
    const post = bulkNotesPost({ entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(['c1', 'c2']), setSelectedIds, notify, t })
    post('hello')
    expect(api.post).toHaveBeenCalledWith('/customers/bulk/notes', { customer_ids: ['c1', 'c2'], text: 'hello' })
    expect(setSelectedIds).toHaveBeenCalledWith(new Set())
  })

  it('posts the exact route and body for vacancies', () => {
    const setSelectedIds = vi.fn()
    const notify = vi.fn()
    vi.mocked(api.post).mockResolvedValue({ data: { updated: ['v1'] } })
    const post = bulkNotesPost({ entity: 'vacancies', idsKey: 'vacancy_ids', selectedIds: new Set(['v1']), setSelectedIds, notify, t })
    post('note text')
    expect(api.post).toHaveBeenCalledWith('/vacancies/bulk/notes', { vacancy_ids: ['v1'], text: 'note text' })
  })

  it('never posts an empty or whitespace-only note', () => {
    const post = bulkNotesPost({ entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(['c1']), setSelectedIds: vi.fn(), notify: vi.fn(), t })
    post('   ')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('never posts with an empty selection', () => {
    const post = bulkNotesPost({ entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(), setSelectedIds: vi.fn(), notify: vi.fn(), t })
    post('hello')
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('bulkArchivePost', () => {
  beforeEach(() => { vi.mocked(api.post).mockReset() })

  it('confirms with a danger option before posting', () => {
    const confirm = vi.fn()
    const archive = bulkArchivePost({
      entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(['c1']),
      setSelectedIds: vi.fn(), setItems: vi.fn(), setTotal: vi.fn(), confirm, notify: vi.fn(), t,
    })
    archive()
    expect(confirm).toHaveBeenCalledWith('bulk.archiveConfirm:1', expect.any(Function), { danger: true })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('posts the exact route and body for customers once confirmed', () => {
    vi.mocked(api.post).mockResolvedValue({ data: { archived: ['c1', 'c2'] } })
    const setItems = vi.fn()
    const setTotal = vi.fn()
    const confirm = (_message: string, onConfirm: () => void) => onConfirm()
    const archive = bulkArchivePost({
      entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(['c1', 'c2']),
      setSelectedIds: vi.fn(), setItems, setTotal, confirm, notify: vi.fn(), t,
    })
    archive()
    expect(api.post).toHaveBeenCalledWith('/customers/bulk/archive', { customer_ids: ['c1', 'c2'] })
  })

  it('posts the exact route and body for vacancies once confirmed', () => {
    vi.mocked(api.post).mockResolvedValue({ data: { archived: ['v1'] } })
    const confirm = (_message: string, onConfirm: () => void) => onConfirm()
    const archive = bulkArchivePost({
      entity: 'vacancies', idsKey: 'vacancy_ids', selectedIds: new Set(['v1']),
      setSelectedIds: vi.fn(), setItems: vi.fn(), setTotal: vi.fn(), confirm, notify: vi.fn(), t,
    })
    archive()
    expect(api.post).toHaveBeenCalledWith('/vacancies/bulk/archive', { vacancy_ids: ['v1'] })
  })

  it('drops the archived rows and adjusts the total once the server confirms', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { archived: ['c1'] } })
    const setItems = vi.fn()
    const setTotal = vi.fn()
    const confirm = (_message: string, onConfirm: () => void) => onConfirm()
    const archive = bulkArchivePost({
      entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(['c1']),
      setSelectedIds: vi.fn(), setItems, setTotal, confirm, notify: vi.fn(), t,
    })
    archive()
    await Promise.resolve()
    await Promise.resolve()
    const itemsUpdater = setItems.mock.calls[0][0]
    expect(itemsUpdater([{ id: 'c1' }, { id: 'c2' }])).toEqual([{ id: 'c2' }])
    const totalUpdater = setTotal.mock.calls[0][0]
    expect(totalUpdater(5)).toBe(4)
  })

  it('never posts with an empty selection', () => {
    const confirm = vi.fn()
    const archive = bulkArchivePost({
      entity: 'customers', idsKey: 'customer_ids', selectedIds: new Set(),
      setSelectedIds: vi.fn(), setItems: vi.fn(), setTotal: vi.fn(), confirm, notify: vi.fn(), t,
    })
    archive()
    expect(confirm).not.toHaveBeenCalled()
  })
})
