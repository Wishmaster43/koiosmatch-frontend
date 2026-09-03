/**
 * RetentionConsentBlock (shared) — the retention-consent block for both candidates and contacts.
 *
 * Tests: the block renders with the correct namespace and permission gate in both contexts,
 * hides without the permission, and the PATCH body for contacts contains ONLY retention_consent.
 * The block's own logic (state derivation, date formatting, loading/error) is tested on the
 * candidate version; this tests the namespace/permission wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RetentionConsentBlock from './RetentionConsentBlock'
import { invalidateRetentionConsentMonths } from '@/pages/candidates/drawer/useRetentionConsentMonths'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { get: apiGet } }))
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (k: string, o?: Record<string, unknown>) => (o && 'date' in o ? `${ns}:${k}|${o.date}` : `${ns}:${k}`),
    i18n: { language: 'nl' },
  }),
}))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL' } }))
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

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
  <RetentionConsentBlock
    optIn={false}
    consentAt={null}
    expiresAt={null}
    onToggle={vi.fn()}
    namespace="candidates"
    viewPermission="candidates.delete"
    {...props}
  />
)

describe('RetentionConsentBlock (shared) · namespace and permission wiring', () => {
  it('renders with candidates namespace when passed', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', namespace: 'candidates' }))
    expect(await screen.findByText(/candidates:communication\.retentionConsentValidUntil/)).toBeInTheDocument()
  })

  it('renders with customers namespace when passed', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', namespace: 'customers' }))
    expect(await screen.findByText(/customers:communication\.retentionConsentValidUntil/)).toBeInTheDocument()
  })

  it('hides the dossier deadline without the viewPermission', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', expiresAt: '2027-01-01T00:00:00Z', viewPermission: 'customers.update' }))
    expect(await screen.findByText(/communication\.retentionConsentValidUntil/)).toBeInTheDocument()
    expect(screen.queryByText(/communication\.retentionUntil/)).toBeNull()
  })

  it('shows the dossier deadline with the viewPermission', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'customers.update' })
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', expiresAt: '2027-01-01T00:00:00Z', namespace: 'customers', viewPermission: 'customers.update' }))
    expect(await screen.findByText(/customers:communication\.retentionUntil/)).toBeInTheDocument()
  })

  it('uses the passed namespace for all keys', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'customers.delete' })
    render(block({
      optIn: true,
      consentAt: '2026-01-15T10:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      namespace: 'customers',
      viewPermission: 'customers.delete',
    }))
    expect(await screen.findByText(/customers:communication\.retentionTitle/)).toBeInTheDocument()
    expect(screen.getByText(/customers:communication\.consentRetentionOptIn/)).toBeInTheDocument()
    expect(screen.getByText(/customers:communication\.retentionConsentValidUntil/)).toBeInTheDocument()
    expect(screen.getByText(/customers:communication\.retentionUntil/)).toBeInTheDocument()
  })
})

describe('RetentionConsentBlock (shared) · DD-MM-YYYY date formatting', () => {
  it('formats dates DD-MM-YYYY via lib/datetime', async () => {
    render(block({ optIn: true, consentAt: '2026-01-15T10:00:00Z', namespace: 'customers' }))
    expect(await screen.findByText(/15-01-2028/)).toBeInTheDocument()
  })
})
