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
 * The OWNER-DEVIATION-1 recruiter tests live in AddApplicationModal.owner.test.tsx.
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
// test explicitly overrides it (owner-deviation tests in AddApplicationModal.owner.test.tsx).
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
  // W30: default back to "no custom fields" between tests.
  vi.mocked(useCustomFields).mockReturnValue({ fields: [] } as unknown as ReturnType<typeof useCustomFields>)
})

describe('AddApplicationModal · searchable pickers (S24b)', () => {
  it('the vacancy picker is a typeable searchable combobox', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
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

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(screen.getByRole('button', { name: 'work.createApplication' })).toBeDisabled()
  })
})
