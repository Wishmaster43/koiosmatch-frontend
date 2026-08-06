/**
 * DocumentTypesSettings (DOCTYPE-ENTITY-1 / DOCTYPE-STRICT-1) — now a thin per-entity
 * StatusListEditor wrapper (registry.jsx `document_types` group renders one instance
 * per entity sub-tab), mirroring NoteTypesSettings. These assert the REQUESTS (§13):
 * the GET is scoped by `?entity=`, and — the key regression guard — an EDIT now sends
 * `entity` too (the old bespoke component deliberately withheld it on edit to protect
 * a cross-entity "Global row" fallback the backend no longer serves; StatusListEditor's
 * plain `entity` prop sends it on every submit, which is now the correct contract).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import DocumentTypesSettings from './DocumentTypesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture row's tenant-picked colour, not a style rule.
const row = (over = {}) => ({ id: 'row-1', name: 'CV', color: '#3B8FD4', icon: null, entity: 'candidate', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('DocumentTypesSettings — per-entity tab', () => {
  it('GETs scoped by the entity prop', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    expect(api.get).toHaveBeenCalledWith('/document-types', { params: { entity: 'candidate' } })
  })

  it('a different entity prop scopes its own GET (registry mounts one instance per tab)', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'row-2', name: 'Contract', entity: 'vacancy' })] })
    render(<DocumentTypesSettings entity="vacancy" />)

    await screen.findByText('Contract')
    expect(api.get).toHaveBeenCalledWith('/document-types', { params: { entity: 'vacancy' } })
  })

  it('creating a type sends this tab entity + name in the POST body', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'row-3', name: 'Diploma' }) })
    const user = userEvent.setup()
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    await user.click(screen.getByRole('button', { name: st('documentTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Diploma')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/document-types', expect.objectContaining({ entity: 'candidate', name: 'Diploma' })))
  })

  // Regression guard for DOCTYPE-STRICT-1: unlike the old bespoke component, an
  // EDIT now sends `entity` too — the backend's strict `?entity=` scope means a
  // row only ever surfaces on its own tab, so re-sending its own entity is a no-op
  // and keeps this lookup's write path consistent with note-types.
  it('editing a type sends its entity in the PUT body', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    // Two "Save" buttons coexist while the modal is open (the toolbar's reorder
    // Save + the modal's submit) — the modal's is always the last in DOM order
    // (mirrors CustomerPhasesSettings/DocumentTypesSettings' prior test).
    const saveButtons = screen.getAllByRole('button', { name: st('common.save') })
    await user.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/document-types/row-1', expect.objectContaining({ entity: 'candidate', name: 'CV' })))
  })

  it('picking a curated icon PUTs it on the row', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    await user.click(screen.getByRole('button', { name: `${st('documentTypes.icon')}: CV` }))
    await user.click(screen.getByRole('menuitem', { name: `${st('documentTypes.icon')}: id-card` }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/document-types/row-1', expect.objectContaining({ icon: 'id-card' })))
  })

  // DOC-GELDIGHEID-1: the requires_expiry flag + default_validity_months number both
  // render as row badges, mirroring TaskStatusSettings' is_done badge assertion.
  it('shows the requires_expiry flag badge and validity-months badge on a configured row', async () => {
    api.get.mockResolvedValue({ data: [row({ requires_expiry: true, default_validity_months: 6 })] })
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    expect(screen.getByText(st('documentTypes.requiresExpiry'))).toBeInTheDocument()
    expect(screen.getByText(`6 ${st('documentTypes.validityMonthsSuffix')}`)).toBeInTheDocument()
  })

  it('creating a type with requires_expiry + a validity POSTs both keys', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'row-4', name: 'VOG', requires_expiry: true, default_validity_months: 12 }) })
    const user = userEvent.setup()
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    await user.click(screen.getByRole('button', { name: st('documentTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'VOG')
    await user.click(screen.getByRole('switch'))
    await user.type(screen.getByDisplayValue(''), '12')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/document-types',
      expect.objectContaining({ entity: 'candidate', name: 'VOG', requires_expiry: true, default_validity_months: 12 })))
  })

  it('keeps an in-use row on a 409 delete instead of removing it', async () => {
    api.get.mockResolvedValue({ data: [row({ in_use: false })] })
    api.delete.mockRejectedValue({ response: { status: 409 } })
    const user = userEvent.setup()
    render(<DocumentTypesSettings entity="candidate" />)

    await screen.findByText('CV')
    // Row layout is [swatch, icon-picker, badge, …, edit, delete] — delete is
    // reliably the LAST button in the row (mirrors AppointmentLocationSettings' test).
    const cvRow = screen.getByText('CV').closest('div')
    const rowButtons = cvRow.querySelectorAll('button')
    await user.click(rowButtons[rowButtons.length - 1])
    await user.click(await screen.findByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/document-types/row-1'))
    expect(screen.getByText('CV')).toBeInTheDocument()
  })
})
