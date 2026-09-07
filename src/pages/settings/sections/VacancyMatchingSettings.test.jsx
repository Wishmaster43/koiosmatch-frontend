/**
 * VacancyMatchingSettings — Danny 22-07: the global matching-strictness slider now
 * shows a concrete number + % alongside the word label (position on the 3-step
 * scale), and the screen no longer renders the purchase→sale conversion factor
 * (moved to Settings → Matches → MatchRatesSettings, its own block). B-48: vacancy
 * leads notification settings added (mode: owner/team, and role picker when team).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import VacancyMatchingSettings from './VacancyMatchingSettings'

// Keep the real unwrap (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
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

// Add the new matching.leads keys to i18n for testing (they live in keys-H2.json, not yet merged into locale files).
const testKeys = {
  nl: {
    'matching.leads.title': 'Meldingen bij nieuwe suggesties',
    'matching.leads.subtitle': 'Bepaal wie wordt geïnformeerd wanneer de AI nieuwe kandidaten voor een vacature vindt.',
    'matching.leads.modeLabel': 'Wie krijgt de melding',
    'matching.leads.modeOwner': 'Eigenaar van de vacature',
    'matching.leads.modeTeam': 'Team met rol',
    'matching.leads.roleLabel': 'Rol',
    'matching.leads.saveFailed': 'Instellingen konden niet worden opgeslagen',
  },
  en: {
    'matching.leads.title': 'Notifications for new suggestions',
    'matching.leads.subtitle': 'Determine who is notified when AI finds new candidates for a vacancy.',
    'matching.leads.modeLabel': 'Who receives the notification',
    'matching.leads.modeOwner': 'Vacancy owner',
    'matching.leads.modeTeam': 'Team with role',
    'matching.leads.roleLabel': 'Role',
    'matching.leads.saveFailed': 'Settings could not be saved',
  },
}

Object.entries(testKeys).forEach(([lang, keys]) => {
  i18n.addResourceBundle(lang, 'settings', keys, true, true)
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('VacancyMatchingSettings', () => {
  it('shows the concrete level number + % alongside the word label for the loaded strictness', async () => {
    api.get.mockResolvedValue({
      data: { data: { matching: { strictness: 'balanced', approval_mode: 'on_deviation' } } },
    })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.balanced'))).toBeInTheDocument())
    // balanced = index 1 of 3 levels → "2/3 · 50%".
    expect(screen.getByText('2/3 · 50%')).toBeInTheDocument()
  })

  it('updates the number + % readout when a different strictness level is picked', async () => {
    api.get.mockResolvedValue({
      data: { data: { matching: { strictness: 'lenient', approval_mode: 'on_deviation' } } },
    })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('1/3 · 0%')).toBeInTheDocument())

    // Drive the slider via its own keyboard support (arrow keys nudge by one step).
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByText('2/3 · 50%')).toBeInTheDocument()
  })

  it('no longer renders the purchase→sale conversion factor input (moved to MatchRatesSettings)', async () => {
    api.get.mockResolvedValue({ data: { data: { matching: { strictness: 'balanced' } } } })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.title'))).toBeInTheDocument())
    // The conversion-factor number input was the only <input type="number"> here.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  // §13 seam audit: the save button must PUT the exact strictness enum picked on
  // the slider plus the vacancy leads notification settings — a callback-fired test
  // alone would miss a wrong route/body.
  it('PUTs /settings/matching with strictness, vacancy_leads_notify_mode, and vacancy_leads_notify_role', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({
      data: {
        data: {
          matching: {
            strictness: 'balanced',
            approval_mode: 'on_deviation',
            vacancy_leads_notify_mode: 'owner',
            vacancy_leads_notify_role: 'recruiter',
          },
        },
      },
    })
    api.put.mockResolvedValue({ data: {} })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText('2/3 · 50%')).toBeInTheDocument())

    const slider = screen.getByRole('slider')
    slider.focus()
    await user.keyboard('{ArrowRight}') // balanced → strict
    await user.click(screen.getByText(st('matching.save')))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/settings/matching', {
        strictness: 'strict',
        vacancy_leads_notify_mode: 'owner',
        vacancy_leads_notify_role: 'recruiter',
      })
    )
  })

  // Approval mode is a partial PUT fired straight from the radio click (no Save
  // button) — assert the exact route + body, not just that the UI re-renders.
  it('PUTs /settings/matching with only the picked approval_mode', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({
      data: {
        data: {
          matching: { strictness: 'balanced', approval_mode: 'on_deviation' },
        },
      },
    })
    api.put.mockResolvedValue({ data: {} })
    render(<VacancyMatchingSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.approval.title'))).toBeInTheDocument())

    await user.click(screen.getByText(st('matching.approval.always')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { approval_mode: 'always' }))
  })

  it('renders vacancy leads notification settings section', async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          matching: {
            strictness: 'balanced',
            approval_mode: 'on_deviation',
            vacancy_leads_notify_mode: 'owner',
            vacancy_leads_notify_role: 'recruiter',
          },
        },
      },
    })
    render(<VacancyMatchingSettings />)

    // Verify the leads section title and mode label are present.
    await waitFor(() => expect(screen.getByText(st('matching.leads.title'))).toBeInTheDocument())
    expect(screen.getByText(st('matching.leads.modeLabel'))).toBeInTheDocument()
  })

  it('shows role picker label only when vacancy leads notification mode is team', async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          matching: {
            strictness: 'balanced',
            approval_mode: 'on_deviation',
            vacancy_leads_notify_mode: 'team',
            vacancy_leads_notify_role: 'recruiter',
          },
        },
      },
    })
    render(<VacancyMatchingSettings />)

    // In team mode, both mode label and role label should be visible.
    await waitFor(() => {
      expect(screen.getByText(st('matching.leads.modeLabel'))).toBeInTheDocument()
      expect(screen.getByText(st('matching.leads.roleLabel'))).toBeInTheDocument()
    })
  })
})
