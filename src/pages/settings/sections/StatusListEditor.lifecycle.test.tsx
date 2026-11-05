/** StatusListEditor · delete, load and entity scoping (split from StatusListEditor.test.tsx; the delete, load-reset and entity-scoping describes). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import StatusListEditor from './StatusListEditor'
import { type } from './StatusListEditor.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

// HUISSTIJL herhaal-audit r6 (aria-label regression): the delete icon Button
// must expose an accessible name in its non-in-use state — a name derived
// only from a conditional `title` (undefined when not in_use) would leave
// the control unlabelled for assistive tech and fail the Button iconOnly
// discriminated-union flip that requires aria-label on every iconOnly Button.
describe('StatusListEditor — delete button accessible name', () => {
  it('exposes an accessible name on the not-in-use delete button', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', in_use: false })] })
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Intake')
    expect(screen.getByRole('button', { name: st('delete', { ns: 'common' }) })).toBeInTheDocument()
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
    const deleteBtn = editBtn.nextElementSibling as HTMLElement
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
    await user.click(editBtn.nextElementSibling as HTMLElement)
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
    api.get.mockImplementation((url: string) => {
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
    // MODAL-HERBOUW-1: the create modal is a real dialog with an accessible name input.
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // SETTINGS-INCON-B2 (Danny 13-09, "AUDIT op alle pop-ups!!"): the create/edit
    // modal is now the shared FloatingPanel — draggable header, no longer the old
    // hand-rolled fixed/centered div with no way to move or resize it.
    expect(dialog.querySelector('[data-drag-handle]')).toBeInTheDocument()
    const nameInput = screen.getByRole('textbox', { name: st('statusList.nameLabel') })
    await user.type(nameInput, 'Intake')
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
