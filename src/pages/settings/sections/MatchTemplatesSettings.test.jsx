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
  employment_type_id: null, function_title: null, linked_vacancies_count: 0,
  ...over,
})

afterEach(() => vi.clearAllMocks())

describe('MatchTemplatesSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    api.get.mockRejectedValue(new Error('network down'))
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

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/settings/match-weight-templates/t1', expect.any(Object)))
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

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
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
})
