/**
 * RetentionSettings (AVG-RET-2, Danny 22-07 punt 8; consent row added 13-08
 * per CMBE handoff; warning and escalation windows added per X-11) — asserts the
 * REAL /settings request (§13: a mutation/read test must prove the seam, never
 * only that a callback fired): the retention windows load with tenant defaults,
 * coerce stored strings to numbers, and save all seven keys on a single POST.
 * The legacy `retention_candidate_months` key is never rendered as a field.
 *
 * CATALOG-EMBED-1: this screen now embeds <CatalogSection section="retention"
 * group="candidates" embedded /> at the bottom, whose useSettingsCatalog() runs its
 * own useQuery — mocked here (mirrors VacancyMatchingSettings.test.jsx) to an empty
 * catalogue so it never interferes with this file's OWN /settings GET/POST
 * assertions (a QueryClientProvider wrapper would still route every api.get call
 * this file already stubs into the catalogue fetch too).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import RetentionSettings from './RetentionSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useQuery: () => ({ data: { sections: [], version: '' }, isLoading: false, isError: false, refetch: vi.fn() }) }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: {} })
})

describe('RetentionSettings — load', () => {
  it('GETs /settings and renders the tenant defaults (12 / 60 / 24 / 36 / 30 / 14 / 30)', async () => {
    render(<RetentionSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findByDisplayValue('12')).toBeInTheDocument() // retention_months_never_placed
    expect(screen.getByDisplayValue('60')).toBeInTheDocument() // retention_months_ever_placed
    expect(screen.getByDisplayValue('24')).toBeInTheDocument() // retention_consent_months
    expect(screen.getAllByDisplayValue('36')).toHaveLength(1) // retention_contact_months
    expect(screen.getAllByDisplayValue('30')).toHaveLength(2) // retention_warning_days + deletion_grace_days
    expect(screen.getByDisplayValue('14')).toBeInTheDocument() // retention_escalation_days
  })

  it('coerces stored string values to numbers', async () => {
    api.get.mockResolvedValue({ data: { retention_months_never_placed: '48', retention_months_ever_placed: '84', retention_consent_months: '12', retention_contact_months: '18' } })
    render(<RetentionSettings />)
    expect(await screen.findByDisplayValue('48')).toBeInTheDocument()
    expect(screen.getByDisplayValue('84')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()
    expect(screen.getByDisplayValue('18')).toBeInTheDocument() // retention_contact_months
  })

  it('never renders the legacy retention_candidate_months key as a field', async () => {
    render(<RetentionSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(screen.queryByText(/retention_candidate_months/i)).not.toBeInTheDocument()
  })
})

describe('RetentionSettings — save', () => {
  it('POSTs all seven retention keys to /settings on save', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const neverPlaced = await screen.findByDisplayValue('12')

    await user.clear(neverPlaced)
    await user.type(neverPlaced, '36')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      retention_months_never_placed: '36', retention_months_ever_placed: '60', retention_consent_months: '24',
      retention_contact_months: '36', retention_warning_days: '30', retention_escalation_days: '14',
      deletion_grace_days: '30',
    }))
  })

  it('allows 0 for consent months (deliberate "never expires") and saves it verbatim', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const consentField = await screen.findByDisplayValue('24')

    await user.clear(consentField)
    await user.type(consentField, '0')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      retention_months_never_placed: '12', retention_months_ever_placed: '60', retention_consent_months: '0',
      retention_contact_months: '36', retention_warning_days: '30', retention_escalation_days: '14',
      deletion_grace_days: '30',
    }))
  })

  // TRASH-OVERAL-2: the trash grace window saves its own key (mirrors the sibling rows).
  it('saves deletion_grace_days when the grace-days row changes', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const graceFields = await screen.findAllByDisplayValue('30')
    const graceField = graceFields[graceFields.length - 1]

    await user.clear(graceField)
    await user.type(graceField, '45')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      retention_months_never_placed: '12', retention_months_ever_placed: '60', retention_consent_months: '24',
      retention_contact_months: '36', retention_warning_days: '30', retention_escalation_days: '14',
      deletion_grace_days: '45',
    }))
  })
})

// Audit finding A: a failed GET /settings must never render as "policy = defaults"
// (AVG-sensitive retention windows) — the shared SettingsScaffold shows an error
// notice and blocks Save until a reload succeeds.
describe('RetentionSettings — load failure (AVG: never save over an unknown policy)', () => {
  it('renders the error notice and disables Save when GET /settings fails', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<RetentionSettings />)

    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
    // The hardcoded defaults never render as if they were the confirmed tenant policy.
    expect(screen.queryByDisplayValue('12')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
  })
})
