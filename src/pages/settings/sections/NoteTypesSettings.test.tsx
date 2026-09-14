/**
 * NoteTypesSettings (NOTE-TYPES-3) — a thin per-entity StatusListEditor wrapper,
 * plus the new General (entity=null) tab. These assert the REQUESTS (§13): GET is
 * scoped by `?entity=`, POST carries `entity`, reorder PUTs only the visible tab's
 * ids — and that a global (entity=null) row is filtered onto the General tab only,
 * never duplicated on an entity tab.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import NoteTypesSettings from './NoteTypesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// A fixture note-type row, overridable per test.
interface RowFixture { id: string; name: string; value: string; label: string; color: string; entity: string | null; in_use: boolean }
const row = (over: Partial<RowFixture> = {}): RowFixture => ({ id: 'row-1', name: 'Intake', value: 'intake', label: 'Intake', color: 'var(--color-primary)', entity: 'candidate', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('NoteTypesSettings — per-entity tab', () => {
  it('GETs scoped by the entity prop', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Intake')
    expect(api.get).toHaveBeenCalledWith('/note-types', { params: { entity: 'candidate' } })
  })

  it('creating a type sends this tab entity + name in the POST body', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'row-2', name: 'Feedback' }) })
    const user = userEvent.setup()
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Intake')
    await user.click(screen.getByRole('button', { name: st('noteTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Feedback')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/note-types', expect.objectContaining({ entity: 'candidate', name: 'Feedback' })))
  })

  it('creating a type carries the slugged value (withValueSlug)', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'row-2', name: 'Follow-up' }) })
    const user = userEvent.setup()
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Intake')
    await user.click(screen.getByRole('button', { name: st('noteTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Follow-up')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/note-types', expect.objectContaining({ entity: 'candidate', name: 'Follow-up', value: 'follow_up' })))
  })

  it('fires PUT /note-types/reorder with only this tab\'s row ids on drop', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 't1', name: 'Intake' }), row({ id: 't2', name: 'Feedback' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Feedback')
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]') as HTMLElement
    fireEvent.dragStart(rowOf('Feedback'))
    fireEvent.dragOver(rowOf('Intake'))
    fireEvent.drop(rowOf('Intake'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/note-types/reorder', { ids: ['t2', 't1'] }))
  })

  it('the value mark carries icon and colour (LOOKUP-ICONEN-1)', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Intake')
    const trigger = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Intake' }) })
    await user.click(trigger)
    expect(screen.getByRole('menu', { name: st('statusList.valueMark', { label: 'Intake' }) })).toBeInTheDocument()
  })

  it('filters out a global (entity=null) row on an entity tab', async () => {
    api.get.mockResolvedValue({ data: [row({ entity: 'candidate' }), row({ id: 'g1', name: 'Statuswissel', entity: null })] })
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Intake')
    expect(screen.queryByText('Statuswissel')).not.toBeInTheDocument()
  })
})

describe('NoteTypesSettings — General tab (entity=null)', () => {
  it('GETs unscoped (no ?entity= param) and keeps only the global rows', async () => {
    api.get.mockResolvedValue({ data: [row({ entity: 'candidate' }), row({ id: 'g1', name: 'Statuswissel', entity: null })] })
    render(<NoteTypesSettings entity={null} />)

    await screen.findByText('Statuswissel')
    expect(api.get).toHaveBeenCalledWith('/note-types', undefined)
    expect(screen.queryByText('Intake')).not.toBeInTheDocument()
  })

  it('creating a type on the General tab POSTs without an entity key', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'g1', name: 'Statuswissel', entity: null })] })
    api.post.mockResolvedValue({ data: row({ id: 'g2', name: 'Dossier', entity: null }) })
    const user = userEvent.setup()
    render(<NoteTypesSettings entity={null} />)

    await screen.findByText('Statuswissel')
    await user.click(screen.getByRole('button', { name: st('noteTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Dossier')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/note-types', expect.not.objectContaining({ entity: expect.anything() })))
  })
})

// Danny 07-09: the location and department tabs showed a raw "nav.location" key —
// every entity tab must resolve its label through the shared nav.* labels.
describe('NoteTypesSettings · entity labels resolve for location and department', () => {
  it.each(['location', 'department'] as const)('renders no raw nav.* key for entity %s', async (entity) => {
    api.get.mockResolvedValue({ data: [] })
    render(<NoteTypesSettings entity={entity} />)
    await screen.findByRole('heading', { level: 3 }).catch(() => null)
    expect(document.body.textContent).not.toMatch(/nav\.(location|department)/)
  })
})

