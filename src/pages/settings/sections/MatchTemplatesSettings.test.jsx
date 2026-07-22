/**
 * MatchTemplatesSettings — covers the four UI states (loading/error/empty/success),
 * the in-use delete protection (409), and Danny's apply-prompt: after saving an edit
 * to a template that is still linked to ≥1 vacancy, a confirm prompt offers to
 * re-apply the new weights onto every linked vacancy (POST …/apply {all_linked}).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { DEFAULT_CONTRACT_TYPES } from '@/lib/useContractTypes'
import { DEFAULT_FUNCTIONS } from '@/lib/useFunctions'
import MatchTemplatesSettings from './MatchTemplatesSettings'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
// Same, for the shared ConfirmDialog's own labels (common namespace).
const ct = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

const template = (over = {}) => ({
  id: 't1', name: 'Senior profile',
  weights: { qualifications: 4, technical_fit: 3, soft_skills: 3, cultural_alignment: 3, career_aspirations: 2, location: 5 },
  contract_types: [], function_title: null, linked_vacancies_count: 0,
  ...over,
})

// Every test's api.get resolves an empty list for any non-templates URL, so the
// useContractTypes/useFunctions lookup hooks fall back to their seed defaults
// (DEFAULT_CONTRACT_TYPES/DEFAULT_FUNCTIONS) — a stable, known option set to drive.
const mockLookupsEmpty = () => Promise.resolve({ data: { data: [] } })

// Exact PATCH body a plain save of `template()` (opened via openEdit, unchanged)
// must send — the six weight-dimension keys plus contract_types/function_title,
// so a field rename in the component surfaces here instead of staying green
// under a loose expect.any(Object)/call-count assertion.
const expectedSavePayload = {
  name: 'Senior profile',
  weights: { qualifications: 4, technical_fit: 3, soft_skills: 3, cultural_alignment: 3, career_aspirations: 2, location: 5 },
  contract_types: [],
  function_title: null,
}

afterEach(() => vi.clearAllMocks())

describe('MatchTemplatesSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    // Only the templates fetch fails — the contract-type/function lookup hooks
    // (useContractTypes/useFunctions) hit different endpoints and must not be
    // rejected too, or their own unhandled-rejection surfaces as test noise.
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates')
        ? Promise.reject(new Error('network down'))
        : Promise.resolve({ data: { data: [] } }))
    render(<MatchTemplatesSettings />)
    expect(screen.getByText(st('common.loading'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('matchTemplatesSettings.loadError'))).toBeInTheDocument())
  })

  it('shows the empty state when there are no templates', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText(st('matchTemplatesSettings.empty'))).toBeInTheDocument())
  })

  it('renders the template list with its linked-vacancy count', async () => {
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates')
        ? Promise.resolve({ data: { data: [template({ linked_vacancies_count: 2 })] } })
        : Promise.resolve({ data: { data: [] } }))
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText('Senior profile')).toBeInTheDocument())
    expect(screen.getByText(st('matchTemplatesSettings.linkedCount', { count: 2 }))).toBeInTheDocument()
  })

  it('delete is blocked (disabled) while the template is still linked to a vacancy', async () => {
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates')
        ? Promise.resolve({ data: { data: [template({ linked_vacancies_count: 3 })] } })
        : Promise.resolve({ data: { data: [] } }))
    const user = userEvent.setup()
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText('Senior profile')).toBeInTheDocument())
    // Expand the card via its chevron toggle (the only icon-only button in the row).
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Senior profile` }))
    const deleteBtn = await screen.findByRole('button', { name: st('matchTemplatesSettings.delete') })
    expect(deleteBtn).toBeDisabled()
  })

  it('after saving an edit to a linked template, confirming re-applies to all linked vacancies', async () => {
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates')
        ? Promise.resolve({ data: { data: [template({ linked_vacancies_count: 1 })] } })
        : Promise.resolve({ data: { data: [] } }))
    api.patch.mockResolvedValue({ data: { data: template({ linked_vacancies_count: 1 }) } })
    api.post.mockResolvedValue({ data: { applied: ['v1'], skipped: [] } })

    const user = userEvent.setup()
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText('Senior profile')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Senior profile` }))
    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/settings/match-weight-templates/t1', expectedSavePayload))
    // Confirm the apply-to-linked-vacancies prompt via the shared ConfirmDialog.
    await user.click(await screen.findByRole('button', { name: ct('confirm') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/match-weight-templates/t1/apply', { all_linked: true }))
  })

  it('declining the apply prompt only saves the template, without calling apply', async () => {
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates')
        ? Promise.resolve({ data: { data: [template({ linked_vacancies_count: 1 })] } })
        : Promise.resolve({ data: { data: [] } }))
    api.patch.mockResolvedValue({ data: { data: template({ linked_vacancies_count: 1 }) } })

    const user = userEvent.setup()
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText('Senior profile')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Senior profile` }))
    await user.click(await screen.findByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/settings/match-weight-templates/t1', expectedSavePayload))
    // Decline the apply-to-linked-vacancies prompt via the shared ConfirmDialog.
    await user.click(await screen.findByRole('button', { name: ct('cancel') }))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a 409 on delete keeps the row and surfaces the in-use block instead of removing it', async () => {
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates')
        ? Promise.resolve({ data: { data: [template({ linked_vacancies_count: 0 })] } })
        : Promise.resolve({ data: { data: [] } }))
    api.delete.mockRejectedValue({ response: { status: 409 } })

    const user = userEvent.setup()
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText('Senior profile')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: `${st('common.edit')}: Senior profile` }))
    await user.click(await screen.findByRole('button', { name: st('matchTemplatesSettings.delete') }))
    // Confirm the delete via the shared ConfirmDialog.
    await user.click(await screen.findByRole('button', { name: ct('confirm') }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/settings/match-weight-templates/t1'))
    // Row survives the 409 (never silently removed) — its name is still on screen.
    expect(screen.getByText('Senior profile')).toBeInTheDocument()
  })

  // Danny 22-07: "Soort dienstverband" is now a searchable MULTI-select (several
  // values checkable, optional) fed from the tenant contract-type lookup; "Functie"
  // is a searchable single-select fed from the candidate function lookup — neither
  // is a hardcoded option list (§3B). Both must persist in the create request body.
  it('Soort dienstverband checks multiple values and Functie is searchable; both persist in the create payload', async () => {
    api.get.mockImplementation((url) =>
      url.includes('match-weight-templates') ? Promise.resolve({ data: { data: [] } }) : mockLookupsEmpty())
    api.post.mockResolvedValue({ data: { data: template({ id: 't2', name: 'Zorg profiel' }) } })

    const user = userEvent.setup()
    render(<MatchTemplatesSettings />)
    await waitFor(() => expect(screen.getByText(st('matchTemplatesSettings.empty'))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('matchTemplatesSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('matchTemplatesSettings.namePlaceholder')), 'Zorg profiel')

    // Open the searchable multi-select and check TWO contract types — the menu
    // stays open between clicks (SearchSelect never auto-closes on toggle).
    await user.click(screen.getByRole('button', { name: st('matchTemplatesSettings.employmentTypeAdd') }))
    await user.click(screen.getByRole('button', { name: DEFAULT_CONTRACT_TYPES[0] }))
    await user.click(screen.getByRole('button', { name: DEFAULT_CONTRACT_TYPES[1] }))
    // Close the menu (outside click) before asserting — both stay checked/rendered
    // as removable chips, proof several values can be checked at once.
    await user.click(screen.getByPlaceholderText(st('matchTemplatesSettings.namePlaceholder')))
    expect(screen.getAllByText(DEFAULT_CONTRACT_TYPES[0]).length).toBeGreaterThan(0)
    expect(screen.getAllByText(DEFAULT_CONTRACT_TYPES[1]).length).toBeGreaterThan(0)

    // Functie — searchable single-select (CreatableSelect); its trigger shows the
    // placeholder text until a value is picked.
    await user.click(screen.getByRole('button', { name: st('matchTemplatesSettings.functionTitlePlaceholder') }))
    await user.click(screen.getByRole('button', { name: DEFAULT_FUNCTIONS[0] }))

    await user.click(screen.getByRole('button', { name: st('matchTemplatesSettings.add') }))

    // Exact body — weights included with all six dimension keys (untouched sliders
    // stay at the neutral default of 3) so this assertion also catches a dimension
    // being dropped/renamed, not only the contract-type/function fields.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/match-weight-templates', {
      name: 'Zorg profiel',
      weights: { qualifications: 3, technical_fit: 3, soft_skills: 3, cultural_alignment: 3, career_aspirations: 3, location: 3 },
      contract_types: [DEFAULT_CONTRACT_TYPES[0], DEFAULT_CONTRACT_TYPES[1]],
      function_title: DEFAULT_FUNCTIONS[0],
    }))
  })
})
