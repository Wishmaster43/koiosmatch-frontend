/** AddApplicationModal · edit mode, required fields and search/source tests (split from AddApplicationModal.test.tsx). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  // warn/block AXIS-MATRIX-2 tests in AddApplicationModal.test.tsx) otherwise leaks into every later
  // test's Create-button state, since this mock is one shared vi.fn() for
  // the whole file (found live: it silently disabled Create in every
  // OWNER-DEVIATION-1 test that ran after the "block" case).
  vi.mocked(useActionRulePreflight).mockReturnValue({ decision: null, loading: false, error: false })
  // W30: default back to "no custom fields" between tests.
  vi.mocked(useCustomFields).mockReturnValue({ fields: [] } as unknown as ReturnType<typeof useCustomFields>)
})

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

  // REQUIRED-A11Y-4: the asterisk-only marker never reached assistive tech —
  // this pins aria-required on the real vacancy trigger.
  it('marks the vacancy trigger aria-required once required, and not otherwise', () => {
    const { unmount } = render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /work\.vacancy/ })).not.toHaveAttribute('aria-required')
    unmount()

    settingsRef.current = { application_required_fields: ['vacancy_id'] }
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    expect(screen.getByRole('button', { name: /work\.vacancy/ })).toHaveAttribute('aria-required', 'true')
  })
})

/**
 * W30 — the vacancy picker server-searches instead of a flat 100-row mount
 * fetch, and the POST body now carries `source` + tenant `custom_fields`
 * (StoreApplicationRequest accepts both, mirroring pages/applications/
 * AddApplicationModal.tsx). §13: request-asserting, not callback-only.
 */
describe('AddApplicationModal · W30 (search + source/custom_fields)', () => {
  it('forwards the typed vacancy query to useVacancyOptions (debounced server search)', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
    await user.type(screen.getByPlaceholderText('work.pickVacancy'), 'zorg')

    await new Promise(r => setTimeout(r, 300))
    expect(useVacancyOptions).toHaveBeenLastCalledWith(true, 'zorg')
  })

  // Golf-1 verify (mirrors pages/applications/AddApplicationModal.test.tsx's
  // pinned regression): the picked vacancy is STICKY state — when the cleared
  // query refetches the unfiltered top-100 WITHOUT the picked row, the trigger
  // must keep its label and the owner chain must keep the vacancy recruiter
  // (the live-lookup version silently re-seeded owner_id down to the me-rung).
  it('keeps the picked vacancy label + owner-chain data after a later search replaces the option list', async () => {
    const user = userEvent.setup()
    vi.mocked(useVacancyOptions).mockImplementation(((_enabled: boolean, search?: string) =>
      search === 'far'
        ? [{ value: 'vac-far', label: 'Verre Vacature', ownerId: 'u3', ownerName: 'Anna Derde' }]
        : [{ value: 'vac-near', label: 'Dichtbij' }]) as never)
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.click(screen.getByRole('button', { name: /work\.vacancy/ }))
    await user.type(screen.getByPlaceholderText('work.pickVacancy'), 'far')
    await new Promise(r => setTimeout(r, 300))
    await user.click(await screen.findByText('Verre Vacature'))
    // The pick resets the query; after the debounce the unfiltered list (without
    // vac-far) is back — label and owner data must survive that swap.
    await new Promise(r => setTimeout(r, 300))
    expect(screen.getByText('Verre Vacature')).toBeInTheDocument()
    expect(screen.queryByText('vac-far')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body.vacancy_id).toBe('vac-far')
    expect(body.owner_id).toBe('u3')
  })

  it('omits custom_fields from the POST body when no tenant def is active', async () => {
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).toHaveBeenCalledWith('/applications', expect.not.objectContaining({ custom_fields: expect.anything() }))
  })

  it('sends the filled-in tenant custom field in the POST body', async () => {
    vi.mocked(useCustomFields).mockReturnValue({
      fields: [{ key: 'shift_pref', label: 'Voorkeur dienst', type: 'text', sort_order: 0, active: true, visible_in_ui: true, has_data: false, required_for: [] }],
    } as unknown as ReturnType<typeof useCustomFields>)
    const user = userEvent.setup()
    render(<AddApplicationModal candidateId="cand-1" onClose={noop} onCreated={noop} />)

    await user.type(screen.getByLabelText('Voorkeur dienst'), 'Nacht')
    await user.click(screen.getByRole('button', { name: 'work.createApplication' }))

    expect(api.post).toHaveBeenCalledWith('/applications', expect.objectContaining({
      custom_fields: { shift_pref: 'Nacht' },
    }))
  })
})
