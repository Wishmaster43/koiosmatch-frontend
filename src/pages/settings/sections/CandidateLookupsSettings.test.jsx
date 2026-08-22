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
import { FunnelStagesSettings, ContractFormsSettings, CandidateStatusesSettings, CandidatePhasesSettings } from './CandidateLookupsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture funnel stage's tenant-picked colour, not a style rule.
const stage = (over = {}) => ({ id: 'f1', value: 'applied', label: 'Gesolliciteerd', color: '#3B8FD4', is_default: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('CandidateLookupsSettings — funnel stage default singleton', () => {
  it('shows the DefaultToggle on funnel stages, with the seeded default disabled', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    render(<FunnelStagesSettings />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
    expect(screen.getByRole('button', { name: st('common.setDefault') })).not.toBeDisabled()
  })

  it('promoting a funnel stage PUTs is_default:true and clears the previous default optimistically', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/funnel-types/f2', expect.objectContaining({ is_default: true })))
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
  })

  // Audit r4: a failed default-flip must revert AND tell the user (the revert
  // alone read as "saved" — the siblings updateColor/reorder already notify).
  it('reverts the default flip and notifies when the PUT fails', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    api.put.mockRejectedValue(new Error('network down'))
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

  it('does not render the DefaultToggle on the contract-forms (candidate_types) block', async () => {
    api.get.mockResolvedValue({ data: {
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
    api.get.mockResolvedValue({ data: {
      /* eslint-disable no-restricted-syntax -- DATA: fixture phase colours, not a style rule. */
      phases: [
        { id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_default: true },
        { id: 'p2', value: 'candidate', label: 'Candidate', color: '#6E8FD6', is_default: false },
      ],
      /* eslint-enable no-restricted-syntax */
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidatePhasesSettings />)

    await screen.findByText('Candidate')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/phases/p2', expect.objectContaining({ is_default: true })))
  })

  // Verify round 22-08 (Opus F2): the delivery's central claim — "only the
  // colour is adjustable" on the locked phases list — asserted on the SEAM:
  // the row swatch PUTs the new colour with the label untouched (§13).
  it('saves a phase COLOUR via the row swatch — label unchanged in the PUT body', async () => {
    api.get.mockResolvedValue({ data: {
      /* eslint-disable no-restricted-syntax -- DATA: fixture phase colours, not a style rule. */
      phases: [
        { id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_default: true },
      ],
      /* eslint-enable no-restricted-syntax */
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    const { container } = render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    const swatchBtn = container.querySelector('button[style*="rgb(59, 143, 212)"]')
    await user.click(swatchBtn)
    const preset = container.querySelector('button[style*="rgb(100, 116, 139)"]') // preset #64748B
    await user.click(preset)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
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
    api.get.mockResolvedValue({ data: {
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

  // Verify round 22-08 (Opus): the flag is READ-ONLY on the locked phases list —
  // this delivery removed reorder, the only tiebreaker when several phases carry
  // it, so an editable flag created a state the tenant could never fix.
  it('renders the is_applicant switch DISABLED on a locked phase — no write path', async () => {
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture phase colour, not a style rule.
      phases: [{ id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false }],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    await user.click(screen.getByTitle(st('lookups.edit')))
    expect(screen.getByRole('switch')).toBeDisabled()
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    expect(api.put.mock.calls[0][1]).toEqual(expect.objectContaining({ is_applicant: false }))
  })

  // P21/KANDIDATEN-13: the label renders as READ-ONLY DATA (not a disabled input) on a
  // structural phase (the server 422s a label rename), but every other modal field —
  // colour, is_applicant, is_default — stays interactive (04-08 audit re-enabled the
  // pencil deliberately; Danny 22-08 asked for the label itself to stop looking editable).
  it('renders the label as static text (with a hint) on a locked phase, and the switch read-only', async () => {
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture phase colour, not a style rule.
      phases: [{ id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false }],
    } })
    const user = userEvent.setup()
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    await user.click(screen.getByTitle(st('lookups.edit')))

    // No input carries the label anymore — it is a static value, never a fake field (§3).
    expect(screen.queryByDisplayValue('Lead')).not.toBeInTheDocument()
    const labelValue = screen.getByTestId('locked-label-value')
    expect(labelValue.tagName).toBe('DIV')
    expect(labelValue).toHaveTextContent('Lead')
    expect(screen.getByText(st('lookups.labelLocked'))).toBeInTheDocument()
    // Verify round 22-08: read-only on the locked list (see the disabled-switch test above).
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('keeps the edit pencil enabled on the locked phases block while hiding add/delete/reorder', async () => {
    api.get.mockResolvedValue({ data: {
      /* eslint-disable no-restricted-syntax -- DATA: fixture phase colours, not a style rule. */
      phases: [
        { id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false },
        { id: 'p2', value: 'candidate', label: 'Candidate', color: '#6E8FD6', is_applicant: true },
      ],
      /* eslint-enable no-restricted-syntax */
    } })
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    // Locked list: no "add" button, no delete button — but the edit pencil stays enabled
    // (CandidateLookupController::update() carries no phases restriction, only store()/
    // destroy() abort_if — audit finding, 04-08).
    expect(screen.queryByRole('button', { name: st('lookups.add') })).not.toBeInTheDocument()
    const editBtn = screen.getAllByTitle(st('lookups.edit'))[0]
    expect(editBtn).not.toBeDisabled()
    // KANDIDATEN-13: two fixed, locked phases have nothing meaningful to reorder — the
    // drag handle and its keyboard up/down equivalent (§6) are both absent.
    expect(screen.queryByRole('button', { name: i18n.t('dragList.moveUp', { ns: 'common' }) })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: i18n.t('dragList.moveDown', { ns: 'common' }) })).not.toBeInTheDocument()
  })

  it('shows the colour-only lock hint on the phases list without opening the edit modal', async () => {
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture phase colour, not a style rule.
      phases: [{ id: 'p1', value: 'lead', label: 'Lead', color: '#3B8FD4', is_applicant: false }],
    } })
    render(<CandidatePhasesSettings />)

    await screen.findByText('Lead')
    expect(screen.getByText(st('lookups.phaseLockedHint'))).toBeInTheDocument()
  })
})

// HUISSTIJL herhaal-audit r6 (aria-label regression): the delete icon Button
// must expose an accessible name in its non-in-use state — a name derived
// only from a conditional `title` (undefined when not in_use) would leave
// the control unlabelled for assistive tech and fail the Button iconOnly
// discriminated-union flip that requires aria-label on every iconOnly Button.
describe('CandidateLookupsSettings — delete button accessible name', () => {
  it('exposes an accessible name on the not-in-use delete button', async () => {
    api.get.mockResolvedValue({ data: {
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
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture status colour, not a style rule.
      statuses: [{ id: 's1', value: 'blacklist', label: 'Blacklist', color: '#DC2626', is_blacklist: false }],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidateStatusesSettings />)

    await screen.findByText('Blacklist')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // The Toggle component exposes no accessible name (no ariaLabel passed here);
    // is_blacklist is the last of the four status modal toggles in render order.
    const switches = screen.getAllByRole('switch')
    await user.click(switches[switches.length - 1])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/statuses/s1', expect.objectContaining({ is_blacklist: true })))
  })
})

describe('CandidateLookupsSettings — funnel is_proposal flag', () => {
  it('saves is_proposal:true on a funnel stage via the edit modal', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Voorgesteld', is_proposal: false })],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Voorgesteld')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // is_proposal is the last of the three funnel modal toggles in render order.
    const switches = screen.getAllByRole('switch')
    await user.click(switches[switches.length - 1])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
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
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture status colour, not a style rule.
      statuses: [{ id: 's1', value: 'available', label: 'Available', color: '#16A34A', icon: null }],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<CandidateStatusesSettings />)

    await screen.findByText('Available')
    // The in-row IconPickerControl trigger is labelled "<icon-label>: <row label>".
    await user.click(screen.getByRole('button', { name: `${st('documentTypes.icon')}: Available` }))
    await user.click(screen.getAllByRole('menuitem')[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/statuses/s1', expect.objectContaining({ icon: 'calendar' })))
  })

  it('does not render the icon picker on funnel stages', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd' })],
    } })
    render(<FunnelStagesSettings />)

    await screen.findByText('Gesolliciteerd')
    expect(screen.queryByRole('button', { name: `${st('documentTypes.icon')}: Gesolliciteerd` })).not.toBeInTheDocument()
  })

  it('saves a picked icon on a contract form via the edit modal', async () => {
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture contract-form colour, not a style rule.
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4', icon: null }],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // Both the row and the modal render an icon-picker trigger with the same
    // accessible name once the modal is open — the modal's is the last one.
    const triggers = screen.getAllByRole('button', { name: `${st('documentTypes.icon')}: ZZP` })
    await user.click(triggers[triggers.length - 1])
    await user.click(screen.getAllByRole('menuitem')[1])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', expect.objectContaining({ icon: 'clock' })))
  })
})

describe('CandidateLookupsSettings — colour + reorder revert on failure', () => {
  it('reverts the colour and notifies when the colour PUT fails', async () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture contract-form's tenant-picked colour, not a style rule.
    api.get.mockResolvedValue({ data: { candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' }] } })
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    const { container } = render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    // The ColorSwatch trigger is an unlabelled button whose own background IS the
    // current colour — select it by that inline style instead of an accessible name.
    const swatchBtn = container.querySelector('button[style*="rgb(59, 143, 212)"]')
    await user.click(swatchBtn)
    const preset = container.querySelector('button[style*="rgb(100, 116, 139)"]') // first preset, #64748B
    await user.click(preset)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the preset colour the test picked, not a style rule.
      '/settings/candidate-lookups/candidate-types/c1', { label: 'ZZP', color: '#64748B' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: the swatch shows the original colour again, not the rejected one.
    expect(container.querySelector('button[style*="rgb(59, 143, 212)"]')).toBeTruthy()
  })

  it('reverts the order and notifies when the reorder PUT fails', async () => {
    /* eslint-disable no-restricted-syntax -- DATA: fixture contract-forms' tenant-picked colours, not a style rule. */
    api.get.mockResolvedValue({ data: { candidate_types: [
      { id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' },
      { id: 'c2', value: 'payroll', label: 'Payroll', color: '#6E8FD6' },
    ] } })
    /* eslint-enable no-restricted-syntax */
    api.put.mockRejectedValue(new Error('network down'))
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

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
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
    api.get.mockResolvedValue({ data: {
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture contract-form colour, not a style rule.
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4', customer_not_applicable: false }],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    await user.click(screen.getByTitle(st('lookups.edit')))
    // customer_not_applicable is the only toggle in the contract-form modal.
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', expect.objectContaining({ customer_not_applicable: true })))
  })
})
