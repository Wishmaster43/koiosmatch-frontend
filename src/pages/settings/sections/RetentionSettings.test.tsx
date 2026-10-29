/**
 * RetentionSettings (AVG-RET-2, Danny 22-07 punt 8; consent row added 13-08
 * per CMBE handoff; warning and escalation windows added per X-11) — asserts the
 * REAL /settings request (§13: a mutation/read test must prove the seam, never
 * only that a callback fired): the retention windows load with tenant defaults,
 * coerce stored strings to numbers, and save all seven keys on a single POST.
 * The retired `retention_candidate_months` key (ONIX S-006) is never rendered as a field.
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
import apiClient from '@/lib/api'
import RetentionSettings from './RetentionSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
// Mutable catalogue payload so one test can supply a privacy row.
const catalog = vi.hoisted(() => ({ data: { sections: [] as unknown[], version: '' } }))
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQuery: () => ({ data: catalog.data, isLoading: false, isError: false, refetch: vi.fn() }) }
})

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  catalog.data = { sections: [], version: '' }
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

  // ONIX S-006 (02-10): the key is retired on the BE and gone from the catalogue; this
  // guard keeps it from ever reappearing as a field through a stale fixture or alias.
  it('never renders the retired retention_candidate_months key as a field', async () => {
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
      retention_warning_days_unit: 'days', retention_escalation_days_unit: 'days', deletion_grace_days_unit: 'days',
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
      retention_warning_days_unit: 'days', retention_escalation_days_unit: 'days', deletion_grace_days_unit: 'days',
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
      retention_warning_days_unit: 'days', retention_escalation_days_unit: 'days', deletion_grace_days_unit: 'days',
    }))
  })

  // O23 UNIT-NAAST-BEDRAG-1: the unit pickers render inline right of their amount,
  // named by their own label, and their chosen value posts alongside the amount.
  it('renders the three window-unit pickers named by their own label', async () => {
    render(<RetentionSettings />)
    await screen.findByDisplayValue('12')
    expect(screen.getByRole('button', { name: t('settings.retention.retention_warning_days_unit.label') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('settings.retention.retention_escalation_days_unit.label') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('settings.retention.deletion_grace_days_unit.label') })).toBeInTheDocument()
  })
})

// S-005: the day-window ceilings follow the chosen unit and warning/escalation never go below 1.
describe('RetentionSettings — per-unit window bounds', () => {
  it('clamps the warning amount to the months ceiling and posts the clamped amount with its unit', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    await screen.findByDisplayValue('12')
    await user.click(screen.getByRole('button', { name: t('settings.retention.retention_warning_days_unit.label') }))
    // "maanden" also labels the other fields' units; the open menu option is the last match.
    await user.click((await screen.findAllByText(t('settings.options.window_unit.months'))).at(-1) as HTMLElement)
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', expect.objectContaining({
      retention_warning_days: '12', retention_warning_days_unit: 'months',
    })))
  })

  it('cannot submit 0 for the warning window (floors to 1)', async () => {
    const user = userEvent.setup()
    render(<RetentionSettings />)
    const warning = (await screen.findAllByDisplayValue('30'))[0]
    await user.clear(warning)
    await user.type(warning, '0')
    await user.tab()
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', expect.objectContaining({ retention_warning_days: '1' })))
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

// K-008: the catalogue "privacy" section mounts under the retention screen as a textarea.
describe('RetentionSettings — privacy section', () => {
  it('renders the privacy notice rows as textareas', async () => {
    catalog.data = { version: '1', sections: [{ id: 'privacy', icon: 'Shield', color: 'info', groups: {}, keys: [{
      key: 'privacy_notice_text_nl', section: 'privacy', group: 'candidates', type: 'string', rules: [], default: null, aliases: [],
      label_key: 'settings.privacy.privacy_notice_text_nl.label', format: 'multiline', ui: 'generic', fe_screen: null,
    }] }] }
    render(<RetentionSettings />)
    const label = t('settings.privacy.privacy_notice_text_nl.label')
    const box = await screen.findByLabelText(label)
    expect(box.tagName).toBe('TEXTAREA')
  })
})
