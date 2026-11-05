/** AddApplicationModal · owner-deviation and recruiter derivation tests (split from AddApplicationModal.test.tsx). */
/**
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
import { useVacancyOptions } from '@/pages/candidates/shared'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import { useCustomFields } from '@/lib/useCustomFields'

// ADDAPPLICATION-TWIN-1: this file renders the real component tree through
// pages/applications/AddApplicationModal (the merged dispatcher), which reaches
// the candidates public surface (§2, `@/pages/candidates/shared`) two ways: this
// component's own `useVacancyOptions` (drawer context), and — for the dispatcher's
// OTHER context ('page') — `AddCandidateModal`. That barrel eagerly re-exports
// ~40 candidate-drawer modules whenever ANY one name is imported from it, one of
// which pulls in @/lib/datetime → a REAL i18n.init() (mirrors BARREL-DATETIME-LES,
// CLAUDE.md §2) that overrides every t() in this test process with actual locale
// strings instead of raw keys. Measured live: every assertion here expects the raw
// key (e.g. `work.pickVacancy`), so the barrel is mocked flat with exactly the two
// names this render path (transitively) touches — 'page'-context AddCandidateModal
// is dead code here, never actually under test.
vi.mock('@/pages/candidates/shared', () => ({ AddCandidateModal: () => null, useVacancyOptions: vi.fn() }))
// W30: no active custom-field defs by default — the "Extra" section renders
// only once a test opts in with ≥1 def (§3A(f)).
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: vi.fn(() => ({ fields: [] })) }))
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
  // warn/block AXIS-MATRIX-2 tests in AddApplicationModal.test.tsx) otherwise leaks into every later
  // test's Create-button state, since this mock is one shared vi.fn() for
  // the whole file (found live: it silently disabled Create in every
  // OWNER-DEVIATION-1 test that ran after the "block" case).
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
  // W30: default back to "no custom fields" between tests.
  vi.mocked(useCustomFields).mockReturnValue({ fields: [] } as unknown as ReturnType<typeof useCustomFields>)
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
    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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
    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: 'work.createApplication' })).toBeEnabled()
  })

  it('shows the vacancy-owner line once the recruiter is manually changed away from the picked vacancy\'s owner', async () => {
    vi.mocked(useVacancyOptions).mockReturnValue([{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A', ownerId: 'u3', ownerName: 'Anna Derde' }])
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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
    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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
