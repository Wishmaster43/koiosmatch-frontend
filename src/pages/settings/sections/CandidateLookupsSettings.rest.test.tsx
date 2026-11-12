/** CandidateLookupsSettings: icons, revert on failure, contract lines, server reasons, open placements. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import { tintBg } from '@/lib/tint'
import { FunnelStagesSettings, ContractFormsSettings, CandidateStatusesSettings } from './CandidateLookupsSettings'
import { st, stage } from './CandidateLookupsSettings.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

afterEach(() => vi.clearAllMocks())

// Audit finding: updateColor/reorder used to be optimistic-with-no-revert (a
// failed PUT looked like it had succeeded, silently swallowed by catch {}).
// Both now revert the optimistic state and notify the user (§13 — assert the
// request AND the rolled-back state, never only that a callback fired).
// Batch 12 (P22-30): icon support on statuses + contract forms only.
describe('CandidateLookupsSettings — icon support (statuses + contract forms)', () => {
  it('shows the in-row icon picker on statuses and saves a picked icon via PUT', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture status colour, not a style rule.
      statuses: [{ id: 's1', value: 'available', label: 'Available', color: '#16A34A', icon: null }],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidateStatusesSettings />)

    await screen.findByText('Available')
    // LOOKUP-ONE-ELEMENT-1: the in-row trigger is the shared LookupValueMark now,
    // labelled "<icon+colour label>: <row label>".
    await user.click(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Available' }) }))
    await user.click(screen.getAllByRole('menuitem')[0])

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/statuses/s1', expect.objectContaining({ icon: 'calendar' })))
  })

  // Updated LOOKUP-ICONS-FE-2 (13-09): funnel stages (application_stages) gained
  // an icon vocabulary on the backend — the mark is now icon-carrying, not
  // test above for the PATCH regression).
  it('renders the icon-carrying mark on funnel stages (icon vocabulary added 13-09)', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd' })],
    } })
    render(<FunnelStagesSettings />)

    await screen.findByText('Gesolliciteerd')
    expect(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Gesolliciteerd' }) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('statusList.colorMark', { label: 'Gesolliciteerd' }) })).not.toBeInTheDocument()
  })

  it('saves a picked icon on a contract form via the edit modal', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture contract-form colour, not a style rule.
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4', icon: null }],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // LOOKUP-ONE-ELEMENT-1: the row's own trigger is now labelled via
    // statusList.valueMark — only the MODAL's IconPickerControl still carries
    // the old documentTypes.icon label, so this now resolves to one match.
    await user.click(screen.getByRole('button', { name: `${st('documentTypes.icon')}: ZZP` }))
    await user.click(screen.getAllByRole('menuitem')[1])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', expect.objectContaining({ icon: 'clock' })))
  })
})

describe('CandidateLookupsSettings — colour + reorder revert on failure', () => {
  // Single source for the fixture's colour (LOOKUP-ONE-ELEMENT-1: contract forms
  // support icons, so the row's mark is now icon-tinted, not a solid swatch fill —
  // the revert assertion below reads this same value through tintBg, never a
  // re-typed literal).
  // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture contract-form's tenant-picked colour, not a style rule.
  const ZZP_COLOR = '#3B8FD4'

  it('reverts the colour and notifies when the colour PUT fails', async () => {
    mockedApi.get.mockResolvedValue({ data: { candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: ZZP_COLOR }] } })
    mockedApi.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    // LOOKUP-ONE-ELEMENT-1: the mark trigger, not a bare ColorSwatch fill —
    // contract forms support icons, so it opens the icon grid + colour palette.
    const markBtn = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'ZZP' }) })
    await user.click(markBtn)
    // SETTINGS-INCON-B2 F1 (Opus review, 13-09): the palette popover is now
    // portalled into document.body (escapes a hosting modal/scroll ancestor's
    // overflow) — it no longer lives inside the render `container`.
    const preset = document.body.querySelector('button[style*="rgb(100, 116, 139)"]') // first preset, #64748B
    await user.click(preset!)

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the preset colour the test picked, not a style rule.
      '/settings/candidate-lookups/candidate-types/c1', { label: 'ZZP', color: '#64748B' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: the trigger tints the ORIGINAL colour again, not the rejected pick.
    expect(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'ZZP' }) }))
      .toHaveInlineStyle({ background: tintBg(ZZP_COLOR, true) })
  })

  it('reverts the order and notifies when the reorder PUT fails', async () => {
    /* eslint-disable no-restricted-syntax -- DATA: fixture contract-forms' tenant-picked colours, not a style rule. */
    mockedApi.get.mockResolvedValue({ data: { candidate_types: [
      { id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' },
      { id: 'c2', value: 'payroll', label: 'Payroll', color: '#6E8FD6' },
    ] } })
    /* eslint-enable no-restricted-syntax */
    mockedApi.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const { container } = render(<ContractFormsSettings />)

    await screen.findByText('Payroll')
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(2)

    // Drag row 0 (ZZP) onto row 1 (Payroll) to swap their order.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])
    fireEvent.dragEnd(rows[0])

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/reorder', { ids: ['c2', 'c1'] }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: ZZP is back in its original (first) position.
    const revertedRows = container.querySelectorAll('[draggable="true"]')
    expect(revertedRows[0]).toHaveTextContent('ZZP')
  })
})

// SAC-10: has_contract_lines was persisted/returned by the backend but had no FE
// control — a tenant-created contract form was stuck false forever. Covers the
// write path and the edit-hydrate guard (openEdit must not silently clear it).
describe('CandidateLookupsSettings — has_contract_lines flag (SAC-10)', () => {
  it('saves has_contract_lines:true on a contract form via the edit modal', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      candidate_types: [{ id: 'c1', value: 'flex_services', label: 'Flex diensten', customer_not_applicable: false, has_contract_lines: false }],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('Flex diensten')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // has_contract_lines carries an accessible name (ariaLabel); select by that.
    await user.click(screen.getByRole('switch', { name: st('lookups.hasContractLines') }))
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', expect.objectContaining({ has_contract_lines: true })))
  })

  // Edit-hydrate guard: opening the modal on a row that already has the flag set
  // must not silently PUT it back to false (the omitted-hydrate bug the finding warned about).
  it('does not clear has_contract_lines on an unrelated edit save', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      candidate_types: [{ id: 'c1', value: 'flex_services', label: 'Flex diensten', customer_not_applicable: false, has_contract_lines: true }],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('Flex diensten')
    await user.click(screen.getByTitle(st('lookups.edit')))
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', expect.objectContaining({ has_contract_lines: true })))
  })
})

// SAC-04: the five handlers threw the server's 422 reason away and always showed
// the generic saveFailed toast — extractApiError now surfaces the real message.
describe('CandidateLookupsSettings — extractApiError surfaces the server reason (SAC-04)', () => {
  it('save() shows the server validation message instead of the generic fallback', async () => {
    mockedApi.get.mockResolvedValue({ data: { statuses: [
      { id: 's1', value: 'available', label: 'Beschikbaar' },
    ] } })
    mockedApi.post.mockRejectedValue({ response: { data: { errors: { value: ['Deze waarde is al in gebruik.'] } } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<CandidateStatusesSettings />)

    await screen.findByText('Beschikbaar')
    await user.click(screen.getByRole('button', { name: st('lookups.add') }))
    await user.type(screen.getByPlaceholderText(st('lookups.labelPlaceholder')), 'Duplicaat')
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Deze waarde is al in gebruik.'))
  })
})

describe('CandidateLookupsSettings — open_placements 409 (LANE-C2)', () => {
  it('shows the open-placement count and keeps the modal open when the funnel PUT answers 409', async () => {
    mockedApi.get.mockResolvedValue({ data: { funnel_types: [stage({ id: 'f1', label: 'Aangenomen' })] } })
    mockedApi.put.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: 'x', open_placements: 2 } } })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByTitle(st('lookups.edit')))
    await user.click(screen.getByText(st('common.save')))

    const { notifyError } = await import('@/lib/notify')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('lookups.openPlacementsBlocked', { count: 2 })))
    expect(notifyError).not.toHaveBeenCalledWith(st('statusList.saveFailed'))
    // REQUEST-ASSERT-1: the handled 409 is declared quiet so the dev write-failure toast stays off.
    expect(mockedApi.put).toHaveBeenCalledWith('/settings/candidate-lookups/funnel-types/f1', expect.any(Object), { quietStatuses: [409] })
    expect(screen.getByText(st('common.save'))).toBeInTheDocument()
  })
})
