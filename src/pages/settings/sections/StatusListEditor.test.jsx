/**
 * StatusListEditor — singleton `is_default` flip (LOOKUP-DEFAULT-1, api 4c25677).
 * Covers the DefaultToggle promotion: clicking "Maak standaard" on a non-default
 * row optimistically clears every other row's flag, PUTs the promoted row, and
 * rolls the optimistic flip back if the backend rejects it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import StatusListEditor from './StatusListEditor'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture type's tenant-picked colour, not a style rule.
const type = (over = {}) => ({ id: 't1', name: 'Intake', color: '#3B8FD4', is_default: false, ...over })

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('StatusListEditor — defaultField singleton', () => {
  it('renders the current default as a "Standaard" pill (clickable, for undo) and the rest as "Maak standaard"', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    // DEFAULT-UNDO (04-08): the active pill is no longer disabled — clicking it clears the default.
    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).not.toBeDisabled()
    const promoteBtn = screen.getByRole('button', { name: st('common.setDefault') })
    expect(promoteBtn).not.toBeDisabled()
  })

  it('promoting a row PUTs is_default:true for it and optimistically clears the previous default', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    await screen.findByText('Kennismaking')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    // The promoted row is sent is_default:true; nothing on the previous default is re-sent.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/appointment-types/t2', expect.objectContaining({ is_default: true })))
    // Optimistic UI: now exactly one "Standaard" pill (t2) and one "Maak standaard" (t1).
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
    expect(screen.getByRole('button', { name: st('common.setDefault') })).toBeInTheDocument()
  })

  it('rolls back the optimistic flip and notifies when the backend rejects the promotion', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    await screen.findByText('Kennismaking')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    // After the rejected PUT, the original default (Intake) is restored.
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
    const rows = screen.getAllByRole('button', { name: st('common.default') })
    expect(rows[0]).toBeInTheDocument()
    // Intake's row still shows the disabled "Standaard" pill (rollback succeeded).
    expect(screen.getByText('Intake').closest('div')).toBeTruthy()
    // Audit finding: the rollback used to be silent — it must notify the user too.
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
  })

  // DEFAULT-UNDO (Danny 04-08): "je kan niet undo doen" — clicking the ACTIVE default clears it.
  it('clicking the active default PUTs {is_default:false} on the same per-id route', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    await user.click(activePill)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/appointment-types/t1', expect.objectContaining({ is_default: false })))
    // No row is default any more — both rows now show "Maak standaard".
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.setDefault') })).toHaveLength(2))
  })
})

// SECOND SINGLETON (04-08): two independent defaultFields, each its own marker/undo,
// promoting/clearing one never touches the other's flag on the same row.
describe('StatusListEditor — multiple independent defaultFields', () => {
  const twoFlagType = (over = {}) => ({ id: 't1', name: 'Intake', color: '#3B8FD4', is_default: false, is_default_for_application: false, ...over })

  it('promoting one singleton PUTs only its own key, leaving the other singleton untouched', async () => {
    api.get.mockResolvedValue({
      data: [
        twoFlagType({ id: 't1', name: 'Intake', is_default: true, is_default_for_application: false }),
        twoFlagType({ id: 't2', name: 'Kennismaking', is_default: false, is_default_for_application: true }),
      ],
    })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultFields={[
        { field: 'is_default', labelKey: 'statusList.default' },
        { field: 'is_default_for_application', labelKey: 'statusList.defaultForApplication' },
      ]} />)

    await screen.findByText('Kennismaking')
    // Promote t1's is_default_for_application (currently false, t2 holds it).
    const rows = screen.getAllByText('Intake')
    expect(rows.length).toBeGreaterThan(0)
    const promoteButtons = screen.getAllByRole('button', { name: st('statusList.defaultForApplication') })
    await user.click(promoteButtons[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/appointment-types/t1',
      expect.objectContaining({ is_default_for_application: true })))
    // The other singleton's own key is never part of this PUT's flip target.
    expect(api.put).not.toHaveBeenCalledWith('/appointment-types/t2', expect.objectContaining({ is_default: expect.anything() }))
  })
})

// Audit finding: a non-409 delete failure (500/network) used to swallow the
// error silently — the row just stayed in the list with no explanation.
describe('StatusListEditor — delete failures notify the user', () => {
  it('notifies on a non-409 delete failure, keeping the row in the list', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake' })] })
    api.delete.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Intake')
    // The delete button is an unlabelled icon button, the immediate sibling of
    // the (labelled) edit button in the row's action group.
    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    const deleteBtn = editBtn.nextElementSibling
    await user.click(deleteBtn)
    // The delete only fires after the house ConfirmDialog's own button is pressed
    // (never a bare window.confirm() — §0 restschuld cleanup).
    await user.click(await screen.findByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/phases/t1'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.deleteFailed')))
    // The row stays — a non-409 failure never removed it from local state.
    expect(screen.getByText('Intake')).toBeInTheDocument()
  })

  it('does not notify on a 409 (in-use) delete rejection — the row is flagged instead', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake' })] })
    api.delete.mockRejectedValue({ response: { status: 409 } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Intake')
    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    await user.click(editBtn.nextElementSibling)
    await user.click(await screen.findByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/phases/t1'))
    expect(notifyError).not.toHaveBeenCalled()
    expect(screen.getByTitle(st('statusList.inUse'))).toBeInTheDocument()
  })
})

// Audit finding: the load effect never reset loading/loadError/notFound when the
// endpoint/entity prop changed, so a stale error/list from the OLD lookup stayed
// on screen while the new one loaded (also missing an alive guard).
describe('StatusListEditor — load effect resets on endpoint/entity change', () => {
  it('clears a previous loadError/list state when the endpoint prop changes', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/phases') return Promise.reject({ response: { status: 500 } })
      if (url === '/statuses') return Promise.resolve({ data: [type({ id: 's1', name: 'Beschikbaar' })] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const { rerender } = render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)
    expect(await screen.findByText(st('statusList.loadError'))).toBeInTheDocument()

    rerender(<StatusListEditor title="Statussen" subtitle="" endpoint="/statuses" addLabel="Status toevoegen" />)

    // The stale error state from /phases must not leak into the /statuses view.
    await waitFor(() => expect(screen.queryByText(st('statusList.loadError'))).not.toBeInTheDocument())
    expect(await screen.findByText('Beschikbaar')).toBeInTheDocument()
  })
})

// NOTE-TYPES-2/3: the `entity` prop scopes a shared lookup (note-types) to one owning
// entity — asserting the actual GET/POST request (not just that a callback fired) so a
// regression that drops the entity scope on either side shows up here (§13).
describe('StatusListEditor — entity scoping (note types)', () => {
  it('GETs the list with ?entity=candidate when an entity prop is passed', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(<StatusListEditor title="Notitietypes" subtitle="" endpoint="/note-types" addLabel="Type toevoegen"
      withColor={false} entity="candidate" />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/note-types', { params: { entity: 'candidate' } }))
  })

  it('omits the params object entirely when no entity prop is passed (unscoped lookups unaffected)', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(<StatusListEditor title="Contacttypes" subtitle="" endpoint="/last-contact-types" addLabel="Type toevoegen" withColor={false} />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/last-contact-types', undefined))
  })

  it('creating a new item POSTs the entity in the body, scoping it to that entity', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: { id: 'n1', name: 'Intake' } })
    const user = userEvent.setup()
    render(<StatusListEditor title="Notitietypes" subtitle="" endpoint="/note-types" addLabel="Type toevoegen"
      withColor={false} entity="candidate" />)

    await user.click(screen.getByRole('button', { name: 'Type toevoegen' }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Intake')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/note-types', expect.objectContaining({ entity: 'candidate', name: 'Intake' })))
  })

  it('editing an existing item PUTs the entity along with the update', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<StatusListEditor title="Notitietypes" subtitle="" endpoint="/note-types" addLabel="Type toevoegen"
      withColor={false} entity="candidate" />)

    await screen.findByText('Intake')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/note-types/t1', expect.objectContaining({ entity: 'candidate' })))
  })
})

// REORDER-SAVES-ON-DROP (decision 04-08): a drag-drop persists immediately via the
// reorder route — no pending-order/Save-button step any more.
describe('StatusListEditor — reorder persists on drop', () => {
  it('fires PUT {endpoint}/reorder with the reordered ids as soon as a row is dropped', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake' }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Kennismaking')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    const source = rowOf('Kennismaking')
    const target = rowOf('Intake')

    // Simulate the native drag sequence the shared DragList listens for.
    fireEvent.dragStart(source)
    fireEvent.dragOver(target)
    fireEvent.drop(target)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/phases/reorder', { ids: ['t2', 't1'] }))
    // No leftover reorder "Save" button — the drop already persisted it.
    expect(screen.queryByRole('button', { name: st('common.save') })).not.toBeInTheDocument()
  })

  it('reverts and notifies when the reorder PUT fails', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake' }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Kennismaking')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Kennismaking'))
    fireEvent.dragOver(rowOf('Intake'))
    fireEvent.drop(rowOf('Intake'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/phases/reorder', { ids: ['t2', 't1'] }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
  })
})

// withIcon retires the bare free-text lucide-key input — it now renders the SAME
// IconPickerControl (fed by the curated generic set), never a raw <input>.
describe('StatusListEditor — withIcon renders the curated picker, not a text input', () => {
  it('shows an icon-picker trigger button in the create modal, not a free-text input', async () => {
    api.get.mockResolvedValue({ data: [] })
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen" withIcon />)

    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))

    // No bare text input for the icon slug any more.
    expect(screen.queryByPlaceholderText(st('statusList.iconPlaceholder'))).not.toBeInTheDocument()
    // The picker trigger is a labelled button (IconPickerControl), not an <input>.
    expect(screen.getByRole('button', { name: `${st('documentTypes.icon', { ns: 'settings' })}: ${st('statusList.iconLabel')}` })).toBeInTheDocument()
  })
})

// Audit finding C(1): only a 404 means "not deployed yet" (notFoundNotice). Any
// OTHER failure (500/network) must render its own error state, never an empty
// list with live CRUD buttons (§3 — error is never the same as empty).
describe('StatusListEditor — load failure (error ≠ empty)', () => {
  it('shows an error state instead of an empty list on a 500', async () => {
    api.get.mockRejectedValue({ response: { status: 500 } })
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    expect(await screen.findByText(st('statusList.loadError'))).toBeInTheDocument()
    // No dead "+ Add" affordance while the real list state is unknown.
    expect(screen.queryByRole('button', { name: 'Fase toevoegen' })).not.toBeInTheDocument()
  })
})

// Audit finding C(2): submit/colour/reorder must notify the user on failure instead
// of ending in a silent catch{} — the api.ts toast is DEV-only, so this is the only
// user-visible signal in production.
describe('StatusListEditor — save failures notify the user', () => {
  it('notifies on a failed create instead of silently swallowing the error', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await user.click(screen.getByRole('button', { name: 'Fase toevoegen' }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Intake')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
  })

  // Reorder-save-on-drop failure is covered by the dedicated
  // "StatusListEditor — reorder persists on drop" describe block below (the Save
  // button that used to trigger this no longer exists, per the 04-08 decision).
})
