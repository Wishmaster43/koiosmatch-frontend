/**
 * CandidateLookupsSettings — funnel-stage/phase singleton `is_default` flip
 * (LOOKUP-DEFAULT-1, api 4c25677; extended 04-08 to phases). Funnel_types and
 * phases carry the DefaultToggle; contract forms / statuses must not render it.
 * Also covers the STATUS is_blacklist and FUNNEL is_proposal modal flags.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import { tintBg } from '@/lib/tint'
import { FunnelStagesSettings, ContractFormsSettings, CandidateStatusesSettings, CandidatePhasesSettings } from './CandidateLookupsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture funnel stage's tenant-picked colour, not a style rule.
const stage = (over = {}) => ({ id: 'f1', value: 'applied', label: 'Gesolliciteerd', color: '#3B8FD4', is_default: false, ...over })

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

// Audit finding: candidate_phases.is_applicant is a real backend flag (Candidate
// LookupController.php:41; ApplicantStatusTransition.php:29/75 reads it to drive the
// Lead→Candidate promotion) that had zero FE control. Not a backend singleton for
// phases (ApplicationStage::SINGLETON_FLAGS excludes is_applicant there) — plain toggle.
describe('CandidateLookupsSettings — phase is_applicant flag', () => {
  it('shows the applicant badge on the flagged phase row', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      /* eslint-disable no-restricted-syntax -- DATA: fixture phase colours, not a style rule. */
      phases: [
        { id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false },
        { id: 'p2', value: 'candidate', label: 'Candidate', color: '#6E8FD6', is_applicant: true },
      ],
      /* eslint-enable no-restricted-syntax */
    } })
    render(<CandidatePhasesSettings />)

    await screen.findByText('Candidate')
    expect(screen.getByText(st('lookups.phaseApplicantBadge'))).toBeInTheDocument()
  })

  it('shows the colour-only lock hint on the phases list', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture phase colour, not a style rule.
      phases: [{ id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false }],
    } })
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    expect(screen.getByText(st('lookups.phaseLockedHint'))).toBeInTheDocument()
  })
})

// readOnly (Danny 13-09, rows 45/46, verbatim: "Potlootje altijd grijs · Delete
// altijd grijs"): a screen-dependent phase disables the pencil/delete/add — grey,
// always PRESENT, never hidden. Supersedes the retired 04-08 "keep the pencil
// enabled" finding and the old add/delete-HIDING behaviour. Since the pencil is
// now unreachable, the is_applicant-switch/label-lock MODAL assertions that used
// to open it (verify round 22-08) are retired too — that path is dead here now;
// the modal's own `locked` behaviour (label read-only) still exists for the OTHER
// call site that can still open it (none currently do, kept for contract parity).
describe('CandidateLookupsSettings — readOnly (system value locked)', () => {
  it('renders the pencil, delete and add controls DISABLED with the systemValueLocked reason, never hidden', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture phase colour, not a style rule.
      phases: [{ id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false }],
    } })
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    const editBtn = screen.getByRole('button', { name: st('lookups.edit') })
    const deleteBtn = editBtn.nextElementSibling
    const addBtn = screen.getByRole('button', { name: st('lookups.add') })

    expect(editBtn).toBeDisabled()
    expect(editBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(editBtn).toHaveAttribute('aria-description', st('statusList.systemValueLocked'))
    // Present, never hidden — the old 04-08/KANDIDATEN-13 hiding behaviour is retired.
    expect(deleteBtn).toBeDisabled()
    expect(deleteBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))
    expect(addBtn).toBeDisabled()
    expect(addBtn).toHaveAttribute('title', st('statusList.systemValueLocked'))

    // KANDIDATEN-13: two fixed phases have nothing meaningful to reorder — unrelated
    // to readOnly, this drag/keyboard-move absence is its own, unchanged reason.
    expect(screen.queryByRole('button', { name: i18n.t('dragList.moveUp', { ns: 'common' }) })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: i18n.t('dragList.moveDown', { ns: 'common' }) })).not.toBeInTheDocument()
  })

  it('the value mark still opens its popover — icon and colour (phases serve icon since LOOKUP-ICONEN-1)', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture phase colour, not a style rule.
      phases: [{ id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false }],
    } })
    const user = userEvent.setup()
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    await user.click(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Lead' }) }))
    expect(screen.getByRole('menu', { name: st('statusList.valueMark', { label: 'Lead' }) })).toBeInTheDocument()
  })
})

// HUISSTIJL herhaal-audit r6 (aria-label regression): the delete icon Button
// must expose an accessible name in its non-in-use state — a name derived
// only from a conditional `title` (undefined when not in_use) would leave
// the control unlabelled for assistive tech and fail the Button iconOnly
// discriminated-union flip that requires aria-label on every iconOnly Button.
describe('CandidateLookupsSettings — delete button accessible name', () => {
  it('exposes an accessible name on the not-in-use delete button', async () => {
    mockedApi.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture contract-form colour, not a style rule.
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4', in_use: false }],
    } })
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    expect(screen.getByRole('button', { name: st('delete', { ns: 'common' }) })).toBeInTheDocument()
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
      '/settings/candidate-lookups/funnel-types/f1', expect.objectContaining({ is_proposal: true })))
  })
})

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
      .toHaveStyle({ background: tintBg(ZZP_COLOR, true) })
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
