/** StatusListEditor · reorder, icons, failures and read-only (split from StatusListEditor.test.tsx; the reorder, icon-picker, failure, read-only and lookup-integrity describes). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

// REORDER-SAVES-ON-DROP (decision 04-08): a drag-drop persists immediately via the
// reorder route — no pending-order/Save-button step any more.
describe('StatusListEditor — reorder persists on drop', () => {
  it('fires PUT {endpoint}/reorder with the reordered ids as soon as a row is dropped', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake' }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Kennismaking')
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]') as HTMLElement
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
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]') as HTMLElement
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

  it('surfaces the server validation reason on a 422 (portie-5 unique-slug guard) instead of the generic toast', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockRejectedValue({ response: { status: 422, data: { errors: { value: ['De slug is al in gebruik.'] } } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/opportunity-stages" addLabel="Fase toevoegen" />)

    await user.click(screen.getByRole('button', { name: 'Fase toevoegen' }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Intake')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('De slug is al in gebruik.'))
  })

  // Reorder-save-on-drop failure is covered by the dedicated
  // "StatusListEditor — reorder persists on drop" describe block above (the Save
  // button that used to trigger this no longer exists, per the 04-08 decision).
})

// readOnly (Danny 13-09, rows 45/46, verbatim: "Potlootje altijd grijs · Delete
// altijd grijs · Plus fase toevoegen grijs"): a system value a screen depends on
// disables the pencil/delete/add — grey, always PRESENT, never hidden — while the
// colour/icon mark and drag-reorder stay fully working. Supersedes the old `locked`
// prop (which hid add/delete outright and kept the pencil enabled).
describe('StatusListEditor — readOnly (system value locked)', () => {
  it('renders the pencil, delete and add controls DISABLED with the systemValueLocked reason, never hidden', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Lead' })] })
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" readOnly />)

    await screen.findByText('Lead')
    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    const deleteBtn = editBtn.nextElementSibling as HTMLElement
    const addBtn = screen.getByRole('button', { name: 'Fase toevoegen' })

    expect(editBtn).toBeDisabled()
    expect(editBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(editBtn).toHaveAttribute('aria-description', st('statusList.systemValueLocked'))
    // Present, not hidden — disabled is the only signal, never a missing element.
    expect(deleteBtn).toBeDisabled()
    expect(deleteBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(deleteBtn).toHaveAttribute('aria-description', st('statusList.systemValueLocked'))
    expect(addBtn).toBeDisabled()
    expect(addBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(addBtn).toHaveAttribute('aria-description', st('statusList.systemValueLocked'))
  })

  it('the value mark still opens its popover under readOnly — colour/icon stay editable', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Lead' })] })
    const user = userEvent.setup()
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" readOnly />)

    await screen.findByText('Lead')
    await user.click(screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Lead' }) }))
    // No icon vocabulary here (withIcon not set) — the popover's role is "dialog",
    // not "menu" (LookupValueMark's ValueMarkPopover picks the role by hasIcons).
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Lead' }) })).toBeInTheDocument()
  })

  it('without readOnly the pencil/delete/add stay fully enabled (regression guard)', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Lead' })] })
    render(<StatusListEditor title="Fasen" subtitle="" endpoint="/phases" addLabel="Fase toevoegen" />)

    await screen.findByText('Lead')
    const editBtn = screen.getByRole('button', { name: st('statusList.edit') })
    expect(editBtn).not.toBeDisabled()
    expect(editBtn).not.toHaveAttribute('aria-description')
    expect(editBtn.nextElementSibling as HTMLElement).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fase toevoegen' })).not.toBeDisabled()
  })
})

describe('StatusListEditor — LANE-C2 lookup integrity', () => {
  it('a system row has a disabled delete with the lock title and never calls DELETE', async () => {
    api.get.mockResolvedValue({ data: [{ ...type({ id: 's1', name: 'Systeemreden' }), is_system: true }] })
    const user = userEvent.setup()
    render(<StatusListEditor title="Redenen" subtitle="" endpoint="/match-stop-reasons" addLabel="Toevoegen" />)

    await screen.findByText('Systeemreden')
    const del = screen.getByRole('button', { name: i18n.t('delete', { ns: 'common' }) })
    expect(del).toBeDisabled()
    expect(del).toHaveAttribute('title', st('statusList.systemReasonLocked'))
    await user.click(del)
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('a flag flip answering 409 reverts the row and toasts the SERVER message', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: 'Nog 3 matches dragen deze status.', matches: 3 } } })
    const user = userEvent.setup()
    render(<StatusListEditor title="Statussen" subtitle="" endpoint="/match-statuses" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    await screen.findByText('Kennismaking')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/match-statuses/t2', expect.objectContaining({ is_default: true })))
    const { notifyError } = await import('@/lib/notify')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Nog 3 matches dragen deze status.'))
    // Reverted: the original default is still the only "Standaard" pill.
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
  })
})
