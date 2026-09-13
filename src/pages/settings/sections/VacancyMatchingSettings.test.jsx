/**
 * VacancyMatchingSettings — Danny 22-07: the global matching-strictness slider shows a
 * concrete number + % alongside the word label; the purchase→sale conversion factor
 * lives in MatchRatesSettings. B-48: vacancy leads notification settings (mode:
 * owner/team, role picker when team).
 *
 * Wire shapes are the MEASURED ones (FE-BE contract audit 09-09, SMZ-01..04):
 * GET /settings/matching is the object, GET /settings is the flat map whose
 * `matching` row is a JSON STRING and whose notify keys sit top-level; the notify
 * keys are written through POST /settings, strictness through PUT /settings/matching.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import VacancyMatchingSettings from './VacancyMatchingSettings'
import { mapRoles } from './vacancyMatchingRoles'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useQuery: vi.fn((config) => {
      // Mock roles query to return recruiter and admin roles.
      if (config.queryKey[0] === 'roles') {
        return {
          data: [
            { name: 'recruiter', label: 'Recruiter' },
            { name: 'admin', label: 'Admin' },
          ],
          isLoading: false,
          isError: false,
        }
      }
      return { data: [], isLoading: false, isError: false }
    }),
  }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// The two GETs the screen makes, in their measured shapes: the matching object under
// the usual {data} envelope, the flat settings map with the matching row as a STRING.
function mockGets({ matching = { strictness: 'balanced', approval_mode: 'on_deviation' }, flat = {} } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/settings/matching') return Promise.resolve({ data: { data: matching } })
    if (url === '/settings') return Promise.resolve({ data: { matching: JSON.stringify(matching), ...flat } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
  api.put.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: {} })
}

afterEach(() => vi.clearAllMocks())

describe('VacancyMatchingSettings', () => {
  it('shows the concrete level number + % alongside the word label for the loaded strictness', async () => {
    mockGets({ matching: { strictness: 'strict', approval_mode: 'on_deviation' } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('3/3 · 100%')).toBeInTheDocument())
  })

  it('updates the number + % readout when a different strictness level is picked', async () => {
    const user = userEvent.setup()
    mockGets()
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('2/3 · 50%')).toBeInTheDocument())
    const slider = screen.getByRole('slider')
    slider.focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('1/3 · 0%')).toBeInTheDocument()
  })

  it('no longer renders the purchase→sale conversion factor input (moved to MatchRatesSettings)', async () => {
    mockGets()
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('2/3 · 50%')).toBeInTheDocument())
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  // SMZ-01/02: Save writes strictness to its own resource and the two notify keys to
  // THEIR owner (POST /settings) — PUT /settings/matching silently dropped them.
  it('Save PUTs /settings/matching with strictness only and POSTs the notify keys to /settings', async () => {
    const user = userEvent.setup()
    mockGets({ flat: { vacancy_leads_notify_mode: 'owner', vacancy_leads_notify_role: 'recruiter' } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('2/3 · 50%')).toBeInTheDocument())

    const slider = screen.getByRole('slider')
    slider.focus()
    await user.keyboard('{ArrowRight}') // balanced → strict
    await user.click(screen.getByText(st('matching.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { strictness: 'strict' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', { vacancy_leads_notify_mode: 'owner', vacancy_leads_notify_role: 'recruiter' }))
  })

  // Approval mode is a partial PUT fired straight from the radio click (no Save
  // button) — assert the exact route + body, not just that the UI re-renders.
  it('PUTs /settings/matching with only the picked approval_mode', async () => {
    const user = userEvent.setup()
    mockGets()
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.approval.title'))).toBeInTheDocument())

    await user.click(screen.getByText(st('matching.approval.always')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { approval_mode: 'always' }))
  })

  // SETTINGS-INCON-B1b: the chosen approval mode reads as chosen via the §4
  // "aan/gelukt" success pair, same green as the super-admin package picker.
  it('paints the chosen approval mode in the success pair', async () => {
    mockGets({ matching: { strictness: 'balanced', approval_mode: 'always' } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.approval.title'))).toBeInTheDocument())

    const active = screen.getByText(st('matching.approval.always')).closest('[role="radio"]')
    const inactive = screen.getByText(st('matching.approval.off')).closest('[role="radio"]')
    expect(active.style.background).toBe('var(--color-success-bg)')
    expect(active.style.border).toBe('1px solid var(--color-success)')
    expect(inactive.style.background).toBe('var(--surface)')
  })

  // SMZ-03: the notify keys are read TOP-LEVEL from the flat map — the matching row
  // (a string there) never carried them, so the screen used to show its defaults.
  it('reads the notify mode/role from the top level of GET /settings and shows the role picker in team mode', async () => {
    mockGets({ flat: { vacancy_leads_notify_mode: 'team', vacancy_leads_notify_role: 'admin' } })
    render(<VacancyMatchingSettings />)

    await waitFor(() => expect(screen.getByText(st('matching.leads.title'))).toBeInTheDocument())
    expect(screen.getByText(st('matching.leads.modeLabel'))).toBeInTheDocument()
    expect(screen.getByText(st('matching.leads.roleLabel'))).toBeInTheDocument()
    expect(screen.getByText(st('matching.leads.modeTeam'))).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('hides the role picker while the notify mode is owner', async () => {
    mockGets({ flat: { vacancy_leads_notify_mode: 'owner' } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.leads.modeLabel'))).toBeInTheDocument())
    expect(screen.queryByText(st('matching.leads.roleLabel'))).not.toBeInTheDocument()
  })

  // SMZ-01: a pick on the mode menu POSTs its single key to /settings — the old
  // single-key PUT /settings/matching 422'd on every click.
  it('picking the notify mode POSTs { vacancy_leads_notify_mode } to /settings, never a PUT', async () => {
    const user = userEvent.setup()
    mockGets({ flat: { vacancy_leads_notify_mode: 'owner' } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.leads.modeOwner'))).toBeInTheDocument())

    await user.click(screen.getByText(st('matching.leads.modeOwner')))
    await user.click(screen.getByRole('button', { name: st('matching.leads.modeTeam') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', { vacancy_leads_notify_mode: 'team' }))
    expect(api.put).not.toHaveBeenCalled()
  })

  // SMZ-03: an unusable matching row (the flat STRING, or nothing) must block Save —
  // otherwise the hardcoded defaults get written over the tenant's real setting.
  it('blocks Save with a load error when /settings/matching does not yield an object', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/settings/matching') return Promise.resolve({ data: { data: '{"strictness":"strict"}' } })
      return Promise.resolve({ data: {} })
    })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('statusList.loadError'))).toBeInTheDocument())
    expect(screen.getByText(st('matching.save')).closest('button')).toBeDisabled()
  })
})

// SMZ-04: GET /roles is a BARE array (RoleController::index) — the old `resp.data?.data ?? []`
// read left the role picker permanently empty in team mode.
describe('mapRoles', () => {
  it('reads a bare array and a {data} envelope alike, labelling rows by label or name', () => {
    const rows = [{ id: 'r1', name: 'recruiter' }, { id: 'r2', name: 'admin', label: 'Beheerder' }]
    expect(mapRoles({ data: rows })).toEqual([{ name: 'recruiter', label: 'recruiter' }, { name: 'admin', label: 'Beheerder' }])
    expect(mapRoles({ data: { data: rows } })).toEqual([{ name: 'recruiter', label: 'recruiter' }, { name: 'admin', label: 'Beheerder' }])
  })
})
