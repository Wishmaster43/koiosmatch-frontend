/**
 * StatusListEditor — singleton `is_default` flip (LOOKUP-DEFAULT-1, api 4c25677).
 * Covers the DefaultToggle promotion: clicking "Maak standaard" on a non-default
 * row optimistically clears every other row's flag, PUTs the promoted row, and
 * rolls the optimistic flip back if the backend rejects it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import StatusListEditor from './StatusListEditor'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const type = (over = {}) => ({ id: 't1', name: 'Intake', color: '#3B8FD4', is_default: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('StatusListEditor — defaultField singleton', () => {
  it('renders the current default as a non-interactive "Standaard" pill and the rest as clickable "Maak standaard"', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
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

  it('rolls back the optimistic flip when the backend rejects the promotion', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockRejectedValue(new Error('network down'))
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
    // withSave=false: the toolbar's own "Opslaan" (reorder) button would otherwise
    // collide with the modal's identically-labelled submit button in this query.
    render(<StatusListEditor title="Notitietypes" subtitle="" endpoint="/note-types" addLabel="Type toevoegen"
      withColor={false} withSave={false} entity="candidate" />)

    await screen.findByText('Intake')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/note-types/t1', expect.objectContaining({ entity: 'candidate' })))
  })
})
