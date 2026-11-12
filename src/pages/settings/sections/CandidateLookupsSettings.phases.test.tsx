/** CandidateLookupsSettings: phase is_applicant flag, readOnly system values, delete button name. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import { ContractFormsSettings, CandidatePhasesSettings } from './CandidateLookupsSettings'
import { st } from './CandidateLookupsSettings.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

afterEach(() => vi.clearAllMocks())

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
