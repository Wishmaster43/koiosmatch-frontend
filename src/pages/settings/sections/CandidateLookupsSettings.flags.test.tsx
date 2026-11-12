/** CandidateLookupsSettings: default singleton plus is_blacklist, is_proposal and customer_not_applicable flags. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import { FunnelStagesSettings, ContractFormsSettings, CandidateStatusesSettings, CandidatePhasesSettings } from './CandidateLookupsSettings'
import { st, stage } from './CandidateLookupsSettings.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

afterEach(() => vi.clearAllMocks())

describe('CandidateLookupsSettings — funnel stage default singleton', () => {
  it('shows the DefaultToggle on funnel stages, with the seeded default disabled', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    render(<FunnelStagesSettings />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
    expect(screen.getByRole('button', { name: st('common.setDefault') })).not.toBeDisabled()
  })

  it('promoting a funnel stage PUTs is_default:true and clears the previous default optimistically', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/funnel-types/f2', expect.objectContaining({ is_default: true })))
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
  })

  // Audit r4: a failed default-flip must revert AND tell the user (the revert
  // alone read as "saved" — the siblings updateColor/reorder already notify).
  it('reverts the default flip and notifies when the PUT fails', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    mockedApi.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: f1 is the default again; f2 offers "make default" once more.
    await waitFor(() => expect(screen.getByRole('button', { name: st('common.setDefault') })).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1)
  })

  // LOOKUP-ICONS-FE-2 (13-09): funnel stages now render the icon-carrying mark
  // (application_stages carries icon/color on the backend), and picking an icon
  // PATCHes {icon} through PUT /settings/candidate-lookups/funnel-types/{id}.
  it('renders the icon-and-colour mark and picking an icon PUTs {icon}', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true })],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Gesolliciteerd')
    const trigger = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Gesolliciteerd' }) })
    await user.click(trigger)
    const iconCell = (await screen.findAllByRole('menuitem'))[0]
    await user.click(iconCell)

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/funnel-types/f1', expect.objectContaining({ icon: expect.any(String) })))
  })

  it('does not render the DefaultToggle on the contract-forms (candidate_types) block', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture contract-form's tenant-picked colour, not a style rule.
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' }],
    } })
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    expect(screen.queryByRole('button', { name: st('common.default') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('common.setDefault') })).not.toBeInTheDocument()
  })

  // 04-08 decision: phases stays add/remove-locked, but the default flag becomes settable.
  it('renders the DefaultToggle on the locked phases block and PUTs is_default:true', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      /* eslint-disable no-restricted-syntax -- DATA: fixture phase colours, not a style rule. */
      phases: [
        { id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_default: true },
        { id: 'p2', value: 'candidate', label: 'Candidate', color: '#6E8FD6', is_default: false },
      ],
      /* eslint-enable no-restricted-syntax */
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidatePhasesSettings />)

    await screen.findByText('Candidate')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/phases/p2', expect.objectContaining({ is_default: true })))
  })

  // Verify round 22-08 (Opus F2): the delivery's central claim — "only the
  // colour is adjustable" on the locked phases list — asserted on the SEAM:
  // the row swatch PUTs the new colour with the label untouched (§13).
  it('saves a phase COLOUR via the row swatch — label unchanged in the PUT body', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      /* eslint-disable no-restricted-syntax -- DATA: fixture phase colours, not a style rule. */
      phases: [
        { id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_default: true },
      ],
      /* eslint-enable no-restricted-syntax */
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    const { container } = render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    const swatchBtn = container.querySelector('button[style*="rgb(59, 143, 212)"]')
    await user.click(swatchBtn!)
    // SETTINGS-INCON-B2 F1 (Opus review, 13-09): the palette popover is now
    // portalled into document.body (escapes a hosting modal/scroll ancestor's
    // overflow) — it no longer lives inside the render `container`.
    const preset = document.body.querySelector('button[style*="rgb(100, 116, 139)"]') // preset #64748B
    await user.click(preset!)

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the picked preset colour, not a style rule.
      '/settings/candidate-lookups/phases/p1', { label: 'Lead', color: '#64748B' }))
  })
})

describe('CandidateLookupsSettings — status is_blacklist flag', () => {
  it('saves is_blacklist:true on a status via the edit modal', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture status colour, not a style rule.
      statuses: [{ id: 's1', value: 'blacklist', label: 'Blacklist', color: '#DC2626', is_blacklist: false }],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidateStatusesSettings />)

    await screen.findByText('Blacklist')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // The Toggle component exposes no accessible name (no ariaLabel passed here);
    // is_blacklist is the last of the four status modal toggles in render order.
    // Select the blacklist flag by its accessible name, never by position (B-38 added flags after it).
    await user.click(screen.getByRole('switch', { name: st('lookups.isBlacklist') }))
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/statuses/s1', expect.objectContaining({ is_blacklist: true })))
  })
})

describe('CandidateLookupsSettings — funnel is_proposal flag', () => {
  it('saves is_proposal:true on a funnel stage via the edit modal', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Voorgesteld', is_proposal: false })],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Voorgesteld')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // is_proposal is the last of the three funnel modal toggles in render order.
    const switches = screen.getAllByRole('switch')
    await user.click(switches[switches.length - 1])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/funnel-types/f1', expect.objectContaining({ is_proposal: true }), { quietStatuses: [409] }))
  })
})

// MATCH-KLANTLOOS-1: the Contractvorm editor's own customer_not_applicable flag —
// mirrors the is_blacklist/is_proposal flag tests above, same shared modal pattern.
describe('CandidateLookupsSettings — customer_not_applicable flag (MATCH-KLANTLOOS-1)', () => {
  it('saves customer_not_applicable:true on a contract form via the edit modal', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture contract-form colour, not a style rule.
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4', customer_not_applicable: false }],
    } })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // customer_not_applicable renders first in the contract-form modal, ahead of
    // has_contract_lines (SAC-10); it carries no accessible name yet (out of this
    // fix's scope, mirrors the file's other unlabelled sibling toggles), so pick by order.
    await user.click(screen.getAllByRole('switch')[0])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', expect.objectContaining({ customer_not_applicable: true })))
  })
})
