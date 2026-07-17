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
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddApplicationModal from './AddApplicationModal'
import api from '@/lib/api'
import { useActionRulePreflight } from '@/components/actionrules'

vi.mock('../hooks/useVacancyOptions', () => ({
  useVacancyOptions: () => [{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A' }],
}))
vi.mock('../hooks/useApplicationStages', () => ({
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

const noop = () => {}

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
      candidate_id: 'cand-1', vacancy_id: 'vac-1', application_stage_id: 'stage-applied',
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
      candidate_id: 'cand-1', vacancy_id: 'vac-1', application_stage_id: 'stage-invited',
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
