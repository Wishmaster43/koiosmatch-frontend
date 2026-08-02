/**
 * RetentionConsentBlock — "bewaartoestemming verloopt" (Danny 2026-08-02).
 *
 * The lie this block exists to prevent: a checked "mag bewaard blijven" box while the
 * consent lapsed months ago. Covered here: the tenant window is READ from the real
 * endpoint (GET /settings), each consent state renders its own honest sentence, the
 * 0-case is worded as a deliberate choice instead of an empty/far-future date, dates
 * come out DD-MM-YYYY through lib/datetime, and loading/error never fake a date.
 *
 * i18n is key-echo (repo precedent) but WITH interpolation, so the formatted date is
 * asserted verbatim. `@/lib/datetime` is deliberately NOT stubbed — the real
 * useDateFormat runs (only its `@/i18n` locale map is stubbed, because importing the
 * real one boots the i18next singleton), which is what proves DD-MM-YYYY is not
 * hand-rolled here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RetentionConsentBlock from './RetentionConsentBlock'
import { invalidateRetentionConsentMonths } from './useRetentionConsentMonths'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { get: apiGet } }))
// Key-echo with interpolation: `key|<value>` keeps the assertions readable while still
// proving WHICH copy renders and WHAT date it carries.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o && 'date' in o ? `${k}|${o.date}` : k),
    i18n: { language: 'nl' },
  }),
}))
// The real `@/i18n` boots the i18next singleton on import; only its locale map is needed.
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL' } }))
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

// Fake ONLY Date (timers stay real, so RTL/userEvent behave normally) — the lapse
// boundary must be deterministic.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-02T12:00:00Z'))
  invalidateRetentionConsentMonths()
  apiGet.mockReset()
  apiGet.mockResolvedValue({ data: { retention_consent_months: '24' } })
  mockUseAuth.mockReturnValue({ hasPermission: () => false })
})
afterEach(() => { vi.useRealTimers() })

const block = (props: Partial<React.ComponentProps<typeof RetentionConsentBlock>> = {}) => (
  <RetentionConsentBlock optIn={false} consentAt={null} expiresAt={null} onToggle={vi.fn()} {...props} />
)

describe('RetentionConsentBlock · the tenant window comes from the API', () => {
  it('GETs the tenant settings map from /settings (and never writes)', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    await screen.findByText(/retentionConsentValidUntil/)
    expect(apiGet).toHaveBeenCalledWith('/settings')
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('reads the tenant value, so a 3-month window lapses a consent 24 months would still cover', async () => {
    apiGet.mockResolvedValue({ data: { retention_consent_months: '3' } })
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    expect(await screen.findByText('communication.retentionConsentLapsed|15-04-2026')).toBeInTheDocument()
  })

  it('falls back to the backend default (24 months) when the tenant never set the key', async () => {
    apiGet.mockResolvedValue({ data: {} })
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    expect(await screen.findByText('communication.retentionConsentValidUntil|15-01-2028')).toBeInTheDocument()
  })
})

describe('RetentionConsentBlock · consent states', () => {
  it('shows until WHEN a valid consent holds, DD-MM-YYYY via lib/datetime', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    expect(await screen.findByText('communication.retentionConsentValidUntil|15-01-2028')).toBeInTheDocument()
  })

  it('says PLAINLY that the consent lapsed, and never renders the "valid until" copy alongside it', async () => {
    render(block({ optIn: true, consentAt: '2023-01-15T10:00:00Z' }))
    expect(await screen.findByText('communication.retentionConsentLapsed|15-01-2025')).toBeInTheDocument()
    expect(screen.queryByText(/retentionConsentValidUntil/)).toBeNull()
  })

  it('words the 0-case as a deliberate choice — no empty and no far-future date', async () => {
    apiGet.mockResolvedValue({ data: { retention_consent_months: '0' } })
    render(block({ optIn: true, consentAt: '2020-01-15T10:00:00Z' }))
    const line = await screen.findByText('communication.retentionConsentIndefinite')
    expect(line).toBeInTheDocument()
    expect(line.textContent).not.toMatch(/\d{2}-\d{2}-\d{4}/)
    expect(screen.queryByText(/retentionConsentValidUntil|retentionConsentLapsed/)).toBeNull()
  })

  it('treats a consent without a provenance date as lapsed, mirroring the backend', async () => {
    render(block({ optIn: true, consentAt: null }))
    expect(await screen.findByText('communication.retentionConsentUndated')).toBeInTheDocument()
  })

  it('states the empty case when no consent was given (never a bare unchecked box)', async () => {
    render(block({ optIn: false, consentAt: null }))
    expect(await screen.findByText('communication.retentionConsentNone')).toBeInTheDocument()
    expect(screen.queryByText(/retentionConsentValidUntil|retentionConsentLapsed|retentionConsentIndefinite/)).toBeNull()
  })

  it('always tells the imperative-expiry story (the workflow only asks to renew)', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    await screen.findByText(/retentionConsentValidUntil/)
    expect(screen.getByText('communication.retentionConsentExpiryNote')).toBeInTheDocument()
  })
})

describe('RetentionConsentBlock · loading & error never fake a date', () => {
  it('shows the loading copy while the tenant window is still in flight', () => {
    apiGet.mockReturnValue(new Promise(() => {})) // never settles
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    expect(screen.getByText('communication.retentionConsentLoading')).toBeInTheDocument()
    expect(screen.queryByText(/retentionConsentValidUntil/)).toBeNull()
  })

  it('says the validity is unknown when the settings read fails — never a guessed deadline', async () => {
    apiGet.mockRejectedValue(new Error('network'))
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z' }))
    expect(await screen.findByText('communication.retentionConsentWindowUnknown')).toBeInTheDocument()
    expect(screen.queryByText(/retentionConsentValidUntil|retentionConsentIndefinite/)).toBeNull()
  })
})

describe('RetentionConsentBlock · toggle, gating and a11y', () => {
  it('flips the opt-in through onToggle (the parent owns the patch)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(block({ optIn: false, onToggle }))
    await user.click(screen.getByLabelText('communication.consentRetentionOptIn'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('turning consent OFF passes false', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', onToggle }))
    await user.click(screen.getByLabelText('communication.consentRetentionOptIn'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('describes the checkbox with the validity line, so a lapsed consent is announced with it', async () => {
    render(block({ optIn: true, consentAt: '2023-01-15T10:00:00Z' }))
    const lapsed = await screen.findByText('communication.retentionConsentLapsed|15-01-2025')
    const box = screen.getByLabelText('communication.consentRetentionOptIn')
    const described = document.getElementById(box.getAttribute('aria-describedby') ?? '')
    expect(described).not.toBeNull()
    expect(described?.contains(lapsed) || described === lapsed).toBe(true)
  })

  it('keeps the dossier deadline behind candidates.delete, while the consent validity stays visible to everyone', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', expiresAt: '2027-01-01T00:00:00Z' }))
    expect(await screen.findByText(/retentionConsentValidUntil/)).toBeInTheDocument()
    expect(screen.queryByText(/communication\.retentionUntil/)).toBeNull()
  })

  it('shows the dossier deadline for a user with candidates.delete', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'candidates.delete' })
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', expiresAt: '2027-01-01T00:00:00Z' }))
    expect(await screen.findByText('communication.retentionUntil|01-01-2027')).toBeInTheDocument()
  })
})
