/**
 * DocumentTypesSettings — V20b entity sub-tabs (Kandidaat/Vacature/Klant). Covers
 * the two behaviours that matter for the entity/global axis: (1) creating a type
 * from a sub-tab sends that tab's `entity` in the POST body, and (2) a Global
 * (entity=null) row is folded into EVERY tab's list, exactly like the backend's
 * `?entity=X OR entity IS NULL` contract — plus a regression guard for the
 * deliberate "edit never sends entity" choice (see the component's own header
 * comment) so a Global row can never be silently narrowed to one entity by an edit.
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

afterEach(() => vi.clearAllMocks())

// A Global row (entity: null) plus one row scoped to whichever entity the mock is
// asked for — mirrors the backend's `?entity=X` response shape (that entity's own
// rows PLUS the global ones) for every tab.
const rowsFor = (ent) => [
  // eslint-disable-next-line no-restricted-syntax -- DATA: fixture rows mirroring stored tenant colours, not UI styling
  { id: 'global-1', name: 'CV', color: '#3B8FD4', entity: null },
  // eslint-disable-next-line no-restricted-syntax -- DATA: fixture rows mirroring stored tenant colours, not UI styling
  { id: `${ent}-1`, name: `${ent} only`, color: '#059669', entity: ent },
]

describe('DocumentTypesSettings — entity sub-tabs', () => {
  it('GETs the default (candidate) tab scoped by entity on mount', async () => {
    api.get.mockResolvedValue({ data: rowsFor('candidate') })
    render(<DocumentTypesSettings />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/document-types', { params: { entity: 'candidate' } }))
  })

  it('creating a type from the active tab sends that tab entity in the POST body', async () => {
    api.get.mockResolvedValue({ data: rowsFor('candidate') })
    // eslint-disable-next-line no-restricted-syntax -- DATA: fixture response mirroring a stored tenant colour, not UI styling
    api.post.mockResolvedValue({ data: { id: 'new-1', name: 'Diploma', color: '#3B8FD4', entity: 'candidate' } })
    const user = userEvent.setup()
    render(<DocumentTypesSettings />)

    await screen.findByText('CV')
    await user.click(screen.getByRole('button', { name: st('documentTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Diploma')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/document-types', expect.objectContaining({ entity: 'candidate', name: 'Diploma' })))
  })

  it('switching tabs re-fetches scoped by the new entity, and a Global row shows on every tab', async () => {
    api.get.mockImplementation((_url, config) => Promise.resolve({ data: rowsFor(config.params.entity) }))
    const user = userEvent.setup()
    render(<DocumentTypesSettings />)

    await screen.findByText('CV')
    expect(screen.getByText('candidate only')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: st('nav.cf_vacancy') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/document-types', { params: { entity: 'vacancy' } }))
    expect(await screen.findByText('vacancy only')).toBeInTheDocument()
    // The Global row is still there — it was never tied to the previous tab.
    expect(screen.getByText('CV')).toBeInTheDocument()
    // The previous tab's own-entity row is gone (the list remounted for the new tab).
    expect(screen.queryByText('candidate only')).not.toBeInTheDocument()
  })

  // Regression guard for the component's deliberate design choice: an edit must
  // never carry `entity`, so a Global row can never be silently narrowed to one
  // entity by renaming/recolouring it from inside a specific tab.
  it('editing the Global row never sends `entity` in the PUT body', async () => {
    api.get.mockResolvedValue({ data: rowsFor('candidate') })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<DocumentTypesSettings />)

    await screen.findByText('CV')
    // rowsFor() lists the Global "CV" row first, so its edit button is index 0.
    const editButtons = screen.getAllByRole('button', { name: st('statusList.edit') })
    await user.click(editButtons[0])
    // Two "Save" buttons coexist while the modal is open (the toolbar's reorder
    // Save + the modal's submit) — the modal's is always the last in DOM order.
    const saveButtons = screen.getAllByRole('button', { name: st('common.save') })
    await user.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [, body] = api.put.mock.calls[0]
    expect(body).not.toHaveProperty('entity')
  })
})
