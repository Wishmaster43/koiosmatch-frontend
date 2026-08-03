/**
 * AddApplicationModal ("+ Solliciteren", candidate drawer) — S24b regression:
 * vacancy + fase are both searchable pick-only comboboxes (not plain selects),
 * the fase picker preselects the tenant's flagged default stage, and — the
 * actual bug fix — the submit now sends the real `application_stage_id` (a
 * stage UUID) instead of the dead `phase_key` the backend silently ignored on
 * create (APP-CREATE-STAGE-1).
 *
 * AXIS-MATRIX-2 (CMFE audit R1): the `application.create` preflight — a warn
 * decision banners but never blocks Create, a block decision banners AND
 * disables it. Only `useActionRulePreflight` is stubbed (real network hook, no
 * QueryClientProvider here); the real `ActionRuleBanner` renders so the banner
 * assertions below exercise the actual component, not a stand-in.
 *
 * OWNER-DEVIATION-1 (Danny: "de recruiter moet default zijn degene die de plus
 * drukt... wijkt deze af... dan moet er wél een melding komen"): the Recruiter
 * picker defaults to the logged-in user (u1 "Piet Recruiter" throughout), and a
 * soft warning names whoever owns the candidate/vacancy when the chosen
 * recruiter differs — proceeding always stays allowed (never a block).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddApplicationModal from './AddApplicationModal'
import api from '@/lib/api'
import { useActionRulePreflight } from '@/components/actionrules'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'

vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: vi.fn() }))
vi.mock('@/hooks/useApplicationStages', () => ({
  useApplicationStages: () => ({
    stages: [
      { id: 'stage-applied', value: 'applied', label: 'Gesolliciteerd', is_default: true },
      { id: 'stage-invited', value: 'invited', label: 'Uitgenodigd/Intake', is_default: false },
    ],
    defaultStage: { id: 'stage-applied', value: 'applied', label: 'Gesolliciteerd', is_default: true },
  }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: { data: {} } })), get: vi.fn(() => Promise.reject({ response: { status: 404 } })) },
}))
// Only the network-backed hook is stubbed (defaults to "no decision") — the real
// ActionRuleBanner renders, so its own P-code styling/markup is what's asserted.
vi.mock('@/components/actionrules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/actionrules')>()),
  useActionRulePreflight: vi.fn(() => ({ decision: null, loading: false, error: false })),
}))
// OWNER-DEVIATION-1: logged-in user + the tenant's assignable users list.
vi.mock('@/lib/queries', () => ({ useUsers: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))

const noop = () => {}

// Default fixtures for every test: u1 "Piet Recruiter" is logged in and
// assignable, u2/u3 are other tenant users; vac-1 carries no owner unless a
// test explicitly overrides it (owner-deviation tests below).
beforeEach(() => {
  vi.mocked(api.post).mockClear()
  vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A' }])
  vi.mocked(useUsers).mockReturnValue({
    data: [{ id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Klaas Anders' }, { id: 'u3', name: 'Anna Derde' }],
  } as unknown as ReturnType<typeof useUsers>)
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'Piet Recruiter' } } as unknown as ReturnType<typeof useAuth>)
  // Reset back to "no decision" — a prior test's own mockReturnValue (the
  // warn/block AXIS-MATRIX-2 tests below) otherwise leaks into every later
  // test's Create-button state, since this mock is one shared vi.fn() for
  // the whole file (found live: it silently disabled Create in every
  // OWNER-DEVIATION-1 test that ran after the "block" case).
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
})

describe('AddApplicationModal · searchable pickers (S24b)', () => {
  it('the vacancy picker is a typeable searchable combobox', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    expect(screen.getByPlaceholderText('work.pickVacancy')).toBeInTheDocument()
  })

  it('preselects the tenant-flagged default stage in the fase picker', () => {
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /Gesolliciteerd/ })).toBeInTheDocument()
  })
})

describe('AddApplicationModal · submits application_stage_id (S24b bug fix)', () => {
  it('sends the real stage id, not the dead phase_key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: {} } })
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).toHaveBeenCalledWith('/applications', {
      candidate_id: 'cand-1', vacancy_id: 'vac-1', owner_id: 'u1', application_stage_id: 'stage-applied',
    })
  })

  it('submits the newly-picked stage id when the recruiter changes the fase', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: {} } })
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    await user.click(screen.getByRole('button', { name: /Gesolliciteerd/ }))
    await user.click(await screen.findByRole('button', { name: /Uitgenodigd\/Intake/ }))
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).toHaveBeenCalledWith('/applications', {
      candidate_id: 'cand-1', vacancy_id: 'vac-1', owner_id: 'u1', application_stage_id: 'stage-invited',
    })
  })
})

describe('AddApplicationModal · AXIS-MATRIX-2 preflight (CMFE audit R1)', () => {
  it('renders nothing extra when the decision is allow (or still loading)', () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.queryByTestId('action-rule-banner')).not.toBeInTheDocument()
  })

  it('warn: shows the banner but leaves Create enabled once a vacancy is picked', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'warn', popup_code: 'P1', message: 'Piet is tijdelijk niet inzetbaar (ziek).' }, loading: false, error: false,
    })
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    const banner = screen.getByTestId('action-rule-banner')
    expect(banner).toHaveAttribute('data-effect', 'warn')
    expect(screen.getByText('Piet is tijdelijk niet inzetbaar (ziek).')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: 'work.createApplication' })).toBeEnabled()
  })

  it('block: shows the banner and disables Create even with a vacancy picked', async () => {
    vi.mocked(useActionRulePreflight).mockReturnValue({
      decision: { effect: 'block', popup_code: 'P3', message: 'Piet staat op de blacklist.' }, loading: false, error: false,
    })
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'block')

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: 'work.createApplication' })).toBeDisabled()
  })
})

describe('AddApplicationModal · OWNER-DEVIATION-1 recruiter default', () => {
  it('defaults the recruiter to the logged-in (assignable) user', () => {
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /Piet Recruiter/ })).toBeInTheDocument()
  })

  it('never proposes a non-assignable logged-in user (e.g. a super-admin) as owner', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'super-1', name: 'Super Admin' } } as unknown as ReturnType<typeof useAuth>)
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument()
    expect(screen.getByText('work.pickOwner')).toBeInTheDocument()
  })

  it('the POST carries the chosen owner_id', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))
    expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ owner_id: 'u1' }))
  })
})

describe('AddApplicationModal · OWNER-DEVIATION-1 deviation notice (soft warning, never a block)', () => {
  it('shows the candidate-owner line when the recruiter differs from the candidate owner', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)
    expect(screen.getByText('work.ownerDeviationCandidate')).toBeInTheDocument()
    expect(screen.queryByText('work.ownerDeviationVacancy')).not.toBeInTheDocument()

    // Never a block (Danny: "wel een melding") — Create stays enabled once a vacancy is picked.
    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: 'work.createApplication' })).toBeEnabled()
  })

  it('shows the vacancy-owner line when the recruiter differs from the picked vacancy\'s owner', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.queryByText('work.ownerDeviationVacancy')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    expect(screen.getByText('work.ownerDeviationVacancy')).toBeInTheDocument()
    expect(screen.queryByText('work.ownerDeviationCandidate')).not.toBeInTheDocument()
  })

  it('shows BOTH lines when both the candidate and the vacancy owner differ', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    expect(screen.getByText('work.ownerDeviationCandidate')).toBeInTheDocument()
    expect(screen.getByText('work.ownerDeviationVacancy')).toBeInTheDocument()
  })

  it('shows no notice when the recruiter matches both the candidate and vacancy owner', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u1', ownerName: 'Piet Recruiter' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u1" candidateOwnerName="Piet Recruiter" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    expect(screen.queryByText('work.ownerDeviationCandidate')).not.toBeInTheDocument()
    expect(screen.queryByText('work.ownerDeviationVacancy')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert', { name: 'work.ownerDeviation' })).not.toBeInTheDocument()
  })

  it('shows no notice when the candidate/vacancy owner is simply unknown (never claims a mismatch against "—")', () => {
    // No candidateOwnerId prop, no vacancy owner in the option — nothing to compare.
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.queryByText('work.ownerDeviationCandidate')).not.toBeInTheDocument()
    expect(screen.queryByText('work.ownerDeviationVacancy')).not.toBeInTheDocument()
  })
})
