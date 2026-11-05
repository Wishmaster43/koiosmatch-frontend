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
import apiClient from '@/lib/api'
import StatusListEditor from './StatusListEditor'
import { type, type TypeFixture } from './StatusListEditor.testKit'

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
  // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture type's tenant-picked colour, not a style rule.
  const twoFlagType = (over: Partial<TypeFixture & { is_default_for_application: boolean }> = {}) => ({ id: 't1', name: 'Intake', color: '#3B8FD4', is_default: false, is_default_for_application: false, ...over })

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

// FLAGFIELDS-1 (04-08): flagField generalizes to a flagFields array — multiple
// independent behaviour flags on the same lookup, each its own modal toggle + row
// badge (mirrors defaultField → defaultFields; no singleton rule between flags).
describe('StatusListEditor — multiple independent flagFields', () => {
  interface FlagRowFixture { id: string; name: string; color: string; is_won: boolean; is_lost: boolean }
  // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture row's tenant-picked colour, not a style rule.
  const twoFlagRow = (over: Partial<FlagRowFixture> = {}): FlagRowFixture => ({ id: 's1', name: 'Won', color: '#3B8FD4', is_won: false, is_lost: false, ...over })

  it('renders one badge per active flag and one toggle per flag in the edit modal', async () => {
    api.get.mockResolvedValue({ data: [twoFlagRow({ is_won: true, is_lost: false })] })
    render(<StatusListEditor title="Stages" subtitle="" endpoint="/opportunity-stages" addLabel="Toevoegen"
      flagFields={[
        { key: 'is_won', label: 'Gewonnen' },
        { key: 'is_lost', label: 'Verloren' },
      ]} />)

    // Only the active flag's badge shows in the row.
    await screen.findByText('Won')
    expect(screen.getByText('Gewonnen')).toBeInTheDocument()
    expect(screen.queryByText('Verloren')).not.toBeInTheDocument()
  })

  it('editing a row PUTs both flag keys, independently toggled in the modal', async () => {
    api.get.mockResolvedValue({ data: [twoFlagRow({ is_won: false, is_lost: false })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<StatusListEditor title="Stages" subtitle="" endpoint="/opportunity-stages" addLabel="Toevoegen"
      flagFields={[
        { key: 'is_won', label: 'Gewonnen' },
        { key: 'is_lost', label: 'Verloren' },
      ]} />)

    await screen.findByText('Won')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    // Only the is_won toggle is switched on; is_lost stays false.
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/opportunity-stages/s1',
      expect.objectContaining({ is_won: true, is_lost: false })))
  })
})
