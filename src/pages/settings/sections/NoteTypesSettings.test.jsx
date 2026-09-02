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
import api from '@/lib/api'
import NoteTypesSettings from './NoteTypesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const row = (over = {}) => ({ id: 'row-1', name: 'Intake', value: 'intake', label: 'Intake', color: 'var(--color-primary)', entity: 'candidate', in_use: false, ...over })

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

  it('fires PUT /note-types/reorder with only this tab\'s row ids on drop', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 't1', name: 'Intake' }), row({ id: 't2', name: 'Feedback' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<NoteTypesSettings entity="candidate" />)

    await screen.findByText('Feedback')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Feedback'))
    fireEvent.dragOver(rowOf('Intake'))
    fireEvent.drop(rowOf('Intake'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/note-types/reorder', { ids: ['t2', 't1'] }))
  })

  // The backend merges global (entity=null) rows into every `?entity=X` response —
  // an entity tab keeps only ITS OWN rows client-side so a global row doesn't render twice.
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
