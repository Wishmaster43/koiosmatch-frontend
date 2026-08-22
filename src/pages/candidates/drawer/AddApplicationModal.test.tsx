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
import { fireEvent, render, screen } from '@testing-library/react'
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
// APP-REQUIRED-FE-1: the component now ALSO fires useApplicationSources's own
// `/candidate-sources` GET on every mount (via useCachedLookup) — that call now
// races the edit-mode `/applications/{id}` GET, so a bare `mockResolvedValueOnce`
// (order-only, ignores the url) could get consumed by the WRONG call. Dispatch by
// URL instead: `appDetailRef` holds the per-test edit-mode fixture explicitly.
const appDetailRef = vi.hoisted(() => ({ current: null as unknown }))
// `unwrap` is exported for real (the component uses it to read the edit-mode
// GET) — a factory mock must carry every named export the component imports.
vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    get: vi.fn((url: string) => {
      if (url === '/settings') return Promise.resolve({ data: {} })
      if (url === '/candidate-sources') return Promise.resolve({ data: { data: [], allow_free_entry: true } })
      if (url.startsWith('/applications/') && appDetailRef.current) return Promise.resolve(appDetailRef.current)
      return Promise.reject({ response: { status: 404 } })
    }),
  },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data ?? r?.data,
  getActiveTenantId: vi.fn(() => 'tenant-1'),
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

// APP-REQUIRED-FE-1: the tenant `application_required_fields` setting, controlled
// per test — mirrors CandidateRequiredFieldsSettings.test.tsx's own blobRef pattern.
// Absent (== {}) by default, matching "nothing extra required" everywhere above.
const settingsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/settings/useAllSettings')>()),
  useAllSettings: () => settingsRef.current,
}))

const noop = () => {}

// Default fixtures for every test: u1 "Piet Recruiter" is logged in and
// assignable, u2/u3 are other tenant users; vac-1 carries no owner unless a
// test explicitly overrides it (owner-deviation tests below).
beforeEach(() => {
  vi.mocked(api.post).mockClear()
  vi.mocked(api.patch).mockClear()
  vi.mocked(api.get).mockClear()
  vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A' }])
  vi.mocked(useUsers).mockReturnValue({
    data: [{ id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Klaas Anders' }, { id: 'u3', name: 'Anna Derde' }],
  } as unknown as ReturnType<typeof useUsers>)
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'Piet Recruiter' } } as unknown as ReturnType<typeof useAuth>)
  settingsRef.current = {}
  appDetailRef.current = null
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

describe('AddApplicationModal · APP-VACANCY-OPTIONAL-1 (open application)', () => {
  it('submits WITHOUT a vacancy — vacancy_id null in the POST body, button never gated on the picker', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: {} } })
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    // The label honestly says the vacancy is optional now.
    expect(screen.getByText('work.vacancyOptional')).toBeInTheDocument()
    const create = screen.getByRole('button', { name: 'work.createApplication' })
    expect(create).toBeEnabled()
    await user.click(create)

    expect(api.post).toHaveBeenCalledWith('/applications', {
      candidate_id: 'cand-1', vacancy_id: null, owner_id: 'u1', application_stage_id: 'stage-applied',
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
  // APP-OWNER-1 note: the derivation chain now auto-seeds the recruiter TO the
  // candidate/vacancy owner whenever one is known+assignable, so the deviation
  // these three tests probe can only still occur after a MANUAL override away
  // from that auto-seeded value (previously the default was always "me", so any
  // known candidate/vacancy owner already deviated from it without a manual step).
  it('shows the candidate-owner line once the recruiter is manually changed away from the candidate owner', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)
    // Auto-seeded to the candidate's own owner (u2, no vacancy known) — no deviation yet.
    expect(screen.queryByText('work.ownerDeviationCandidate')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Klaas Anders/ }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))
    expect(screen.getByText('work.ownerDeviationCandidate')).toBeInTheDocument()
    expect(screen.queryByText('work.ownerDeviationVacancy')).not.toBeInTheDocument()

    // Never a block (Danny: "wel een melding") — Create stays enabled once a vacancy is picked.
    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: 'work.createApplication' })).toBeEnabled()
  })

  it('shows the vacancy-owner line once the recruiter is manually changed away from the picked vacancy\'s owner', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    // Auto-seeded to the vacancy's own recruiter (u3) — no deviation yet.
    expect(screen.queryByText('work.ownerDeviationVacancy')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Anna Derde/ }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))

    expect(screen.getByText('work.ownerDeviationVacancy')).toBeInTheDocument()
    expect(screen.queryByText('work.ownerDeviationCandidate')).not.toBeInTheDocument()
  })

  it('shows BOTH lines when a manual pick differs from both the candidate and the vacancy owner', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    // Manually override to a THIRD user — differs from both record owners.
    await user.click(screen.getByRole('button', { name: /Anna Derde/ }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))

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

describe('AddApplicationModal · APP-OWNER-1 recruiter derivation chain', () => {
  it('the picked vacancy\'s recruiter wins over the candidate owner', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))

    // The vacancy's own recruiter (u3) wins over the candidate's own owner (u2).
    expect(screen.getByRole('button', { name: /Anna Derde/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))
    expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ owner_id: 'u3' }))
  })

  it('falls back to the candidate owner, then further to the logged-in user', () => {
    // Candidate owner known + assignable, no vacancy picked yet -> candidate owner wins.
    const { unmount } = render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /Klaas Anders/ })).toBeInTheDocument()
    unmount()

    // Neither a candidate owner nor a vacancy -> falls all the way to the logged-in user.
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /Piet Recruiter/ })).toBeInTheDocument()
  })

  it('a manual pick survives a later vacancy pick', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" candidateOwnerId="u2" candidateOwnerName="Klaas Anders" onClose={noop} onCreated={noop} />)

    // Manually pick a recruiter BEFORE the vacancy is chosen.
    await user.click(screen.getByRole('button', { name: /Klaas Anders/ }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))

    // Picking the vacancy afterwards must NOT reseed the manual pick, even though
    // the vacancy's own recruiter (u3) would otherwise outrank it.
    await user.click(screen.getByRole('button', { name: 'work.pickVacancy' }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: /Piet Recruiter/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))
    expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ owner_id: 'u1' }))
  })
})

/**
 * EDIT MODE (Danny punt 5, 08-08) — the pencil on a candidate application row
 * reopens THIS form with `editApplicationId` set: prefill from
 * GET /applications/{id}, then PATCH /applications/{id} with the CHANGED fields
 * only. The route + field names are the measured contract (UpdateApplicationRequest
 * validates vacancy_id / owner_id / application_stage_id, each `sometimes`), so
 * these assertions name the exact method, route and body — never "a callback fired"
 * (§13, the dead bulk-unlink lesson).
 */
describe('AddApplicationModal · EDIT mode (punt 5)', () => {
  // Vacancy vac-1, recruiter u2 (NOT the logged-in u1), fase invited.
  const detail = { data: { data: { id: 'app-1', vacancy: { id: 'vac-1', title: 'Verzorgende IG' }, owner: { id: 'u2', name: 'Klaas Anders' }, phase_key: 'invited' } } }

  it('prefills vacancy, recruiter and fase from GET /applications/{id}', async () => {
    appDetailRef.current = detail
    render(<AddApplicationModal candidateId="cand-1" editApplicationId="app-1" onClose={noop} onCreated={noop} />)

    expect(api.get).toHaveBeenCalledWith('/applications/app-1')
    // The record's OWN stage wins over the tenant default (stage-applied)...
    expect(await screen.findByRole('button', { name: /Uitgenodigd\/Intake/ })).toBeInTheDocument()
    // ...and its OWN owner over the create-time derivation chain (which would pick u1).
    expect(screen.getByRole('button', { name: /Klaas Anders/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verzorgende IG/ })).toBeInTheDocument()
    // Edit is not a create: the header/button read as an edit.
    expect(screen.getByRole('button', { name: 'common:save' })).toBeInTheDocument()
  })

  it('PATCHes the exact route + only the CHANGED field', async () => {
    appDetailRef.current = detail
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" editApplicationId="app-1" onClose={noop} onCreated={noop} />)

    // Move the fase invited -> applied; vacancy and recruiter stay untouched.
    await user.click(await screen.findByRole('button', { name: /Uitgenodigd\/Intake/ }))
    await user.click(await screen.findByRole('button', { name: /Gesolliciteerd/ }))
    await user.click(screen.getByRole('button', { name: 'common:save' }))

    expect(api.patch).toHaveBeenCalledWith('/applications/app-1', { application_stage_id: 'stage-applied' })
    // An edit must never fall through to the create route.
    expect(api.post).not.toHaveBeenCalled()
  })

  it('sends the changed recruiter as owner_id', async () => {
    appDetailRef.current = detail
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" editApplicationId="app-1" onClose={noop} onCreated={noop} />)

    await user.click(await screen.findByRole('button', { name: /Klaas Anders/ }))
    await user.click(await screen.findByRole('button', { name: 'Anna Derde' }))
    await user.click(screen.getByRole('button', { name: 'common:save' }))

    expect(api.patch).toHaveBeenCalledWith('/applications/app-1', { owner_id: 'u3' })
  })

  it('writes nothing when nothing changed (an unchanged stage would log a phantom transition)', async () => {
    appDetailRef.current = detail
    const onCreated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" editApplicationId="app-1" onClose={onClose} onCreated={onCreated} />)

    await user.click(await screen.findByRole('button', { name: 'common:save' }))
    expect(api.patch).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

// VAC-CLEAR in the apply modal (Danny 13-08): a picked optional vacancy must be
// releasable — the clear cross returns the picker to its placeholder.
it('clears a picked vacancy back to an open application', async () => {
  render(<AddApplicationModal candidateId="cand-1" initialVacancyId="v1" onClose={noop} onCreated={noop} />)
  const clear = await screen.findByTitle(/clearField/i)
  fireEvent.click(clear)
  expect(await screen.findByText(/work\.pickVacancy/i)).toBeInTheDocument()
})

// KOIOS-VOORSTEL-1: same contract as the intake modal — suggested = badged,
// cleared = recruiter's own; the score-panel's initialVacancyId stays badge-less.
it('shows the Koios badge on a SUGGESTED vacancy and dissolves it on clear', async () => {
  render(<AddApplicationModal candidateId="cand-1" suggestedVacancyId="v1" onClose={noop} onCreated={noop} />)
  expect(await screen.findByTestId('koios-suggestion')).toBeInTheDocument()
  fireEvent.click(await screen.findByTitle(/clearField/i))
  expect(screen.queryByTestId('koios-suggestion')).toBeNull()
})

it('shows NO badge for the score-panel initialVacancyId (own click, not a proposal)', async () => {
  render(<AddApplicationModal candidateId="cand-1" initialVacancyId="v1" onClose={noop} onCreated={noop} />)
  fireEvent.click(await screen.findByTitle(/clearField/i))
  expect(screen.queryByTestId('koios-suggestion')).toBeNull()
})

/**
 * APP-REQUIRED-FE-1 (Danny: "hoe zorg ik dat BRON bij nieuwe sollicitatie
 * verplicht is? moet bij instellingen komen") — the tenant `application_required_
 * fields` setting (flat array, no phase axis). §13: the block/allow assertions
 * check the REQUEST (api.post called or not), never only a callback.
 */
// The required-marker asterisk is a sibling <span>, so the label text is split
// across two DOM nodes — RTL's default getByText only reads a node's OWN direct
// text and ignores nested elements ("text broken up by multiple elements"), so a
// plain string/regex query can't see the combined "label*" text. This scoped
// function matcher checks the full textContent (label + marker) of ONE element
// exactly, which only the label's own wrapping div can match.
const exactText = (text: string) => (_content: string, el: Element | null) => el?.textContent === text

describe('AddApplicationModal · APP-REQUIRED-FE-1 (tenant-configurable required fields)', () => {
  it('with the setting absent, nothing extra is required and Create submits without a source', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).toHaveBeenCalledWith('/applications', expect.not.objectContaining({ source: expect.anything() }))
  })

  it('marks Bron required (asterisk) and blocks an empty submit client-side, without calling the server', async () => {
    settingsRef.current = { application_required_fields: JSON.stringify(['source']) }
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    // The label reads plain "filters.source" plus the red asterisk marker — an
    // EXACT match so this never collides with the picker's own OWN placeholder
    // span, which shows the unmarked "filters.source" text while unset.
    expect(screen.getByText(exactText('filters.source*'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('common:errors.fieldRequired')).toBeInTheDocument()
  })

  it('lets the recruiter proceed once the required source is picked', async () => {
    settingsRef.current = { application_required_fields: ['source'] }
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    // The trigger's accessible name is LABEL + own content (§6 aria-labelledby
    // wiring, added in the Opus round) — match on the label part.
    await user.click(screen.getByRole('button', { name: /filters\.source/ }))
    await user.click(await screen.findByRole('button', { name: 'Indeed' }))
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({ source: 'Indeed' }))
  })

  it('a server 422 naming source still maps onto the field via the existing API_TO_FORM path', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: 'Ongeldige gegevens.', errors: { source: ['ongeldige bron'] } } },
    })
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    // Not client-required here (setting absent) — the generic existing message
    // shows, proving the 422 -> errors.source mapping still fires (API_TO_FORM).
    await screen.findByText('work.applicationFailed')
  })

  it('marks Vacature/Fase/Recruiter required too, each from the same flat array', () => {
    settingsRef.current = { application_required_fields: ['vacancy_id', 'owner_id', 'application_stage_id'] }
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    expect(screen.getByText(exactText('work.vacancy*'))).toBeInTheDocument()
    expect(screen.getByText(exactText('work.phase*'))).toBeInTheDocument()
    expect(screen.getByText(exactText('work.owner*'))).toBeInTheDocument()
  })

  it('blocks Create when a required vacancy is missing, without touching the server', async () => {
    settingsRef.current = { application_required_fields: ['vacancy_id'] }
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).not.toHaveBeenCalled()
    expect(screen.getByText('common:errors.fieldRequired')).toBeInTheDocument()
  })

  it('the client preflight never runs in EDIT mode (the guard is create-only)', async () => {
    settingsRef.current = { application_required_fields: ['source'] }
    appDetailRef.current = { data: { data: { id: 'app-1', vacancy: null, owner: null, phase_key: 'applied' } } }
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" editApplicationId="app-1" onClose={noop} onCreated={noop} />)

    // Nothing changed from the loaded (empty) record, so Save closes without a
    // PATCH — the required-source rule must not block an edit of other fields.
    await user.click(await screen.findByRole('button', { name: 'common:save' }))
    expect(api.patch).not.toHaveBeenCalled()
  })
})
