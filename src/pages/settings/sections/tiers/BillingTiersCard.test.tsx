/**
 * BillingTiersCard (task E3) — asserts the real request seam: GET route, the
 * dirty-only PUT body for an AI price edit, an overage toggle and an
 * upgrade-contact clear, the unavailable phase on 404, and the tenant-
 * assignment PUT. TierCatalogTable and TierPlatformTogglesCard mount FOR
 * REAL (F1) so a container regression that spreads a whole nested object
 * onto one field change is caught here, not just in their own unit tests;
 * only TierPackageIncludesCard and TenantTierAssignment stay stubbed.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import BillingTiersCard from './BillingTiersCard'
import type { AdminTenantBillingTiersUpdate } from '@/types/billingTiers'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', async () => {
  const actual = await vi.importActual('@/lib/notify')
  return { ...actual, notifyError: vi.fn(), notifySuccess: vi.fn() }
})

// TierPackageIncludesCard renders no server-request seam of its own here, so
// it stays a bare stub — the real component ships its own unit test.
vi.mock('./TierPackageIncludesCard', () => ({ default: () => <div>includes-stub</div> }))
vi.mock('./TenantTierAssignment', () => ({
  default: ({ onAssign }: { onAssign: (tenantId: string, body: AdminTenantBillingTiersUpdate) => Promise<void> }) => (
    <button onClick={() => onAssign('t-1', { ai_tier: 'pro', effective_from: '2026-09-01' })}>assign-tenant</button>
  ),
}))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

const catalog = {
  ai_tiers: [
    { key: 'assist', label: 'Assist', monthly_tokens: 1000, price_cents: 0, sort: 1, active: true, in_use: 2 },
    { key: 'pro', label: 'Pro', monthly_tokens: 50000, price_cents: 19900, sort: 3, active: true, in_use: 1 },
  ],
  workflow_tiers: [
    { key: 'start', label: 'Start', monthly_runs: 500, price_cents: 4900, sort: 1, active: true, in_use: 0 },
  ],
  overage: { ai_enabled: true, ai_price_cents: 5, workflow_enabled: true, workflow_price_cents: 10 },
  warn_at_pct: 80,
  upgrade_contact: 'mailto:sales@koios.example',
  package_baselines: { core: { ai_tier_key: 'assist', workflow_runs: 500 } },
}

function mockGet() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/admin/billing-tiers') return Promise.resolve({ data: catalog })
    if (url === '/admin/tenants/t-1/billing-tiers') {
      return Promise.resolve({ data: { ai: { effective: { key: 'pro' } }, workflow: { effective: null } } })
    }
    return Promise.resolve({ data: {} })
  })
}

describe('BillingTiersCard', () => {
  it('GETs /admin/billing-tiers on mount and renders the real catalog rows', async () => {
    mockGet()
    render(<BillingTiersCard />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/billing-tiers'))
    expect(await screen.findByDisplayValue('Pro')).toBeInTheDocument()
  })

  it('PUTs only the edited AI tier price (real TierCatalogTable)', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: catalog })
    render(<BillingTiersCard />)

    // Two rows share the "colPrice" aria-label — Assist is index 0, Pro is index 1.
    const priceInputs = await screen.findAllByLabelText(t('billingTiers.colPrice'))
    fireEvent.change(priceInputs[1], { target: { value: '299' } })

    const saveBtn = await screen.findByRole('button', { name: t('common.save') })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-tiers', {
      ai_tiers: [{ key: 'pro', price_cents: 299 }],
    }))
  })

  it('PUTs only the toggled overage field, never the sibling overage fields (real TierPlatformTogglesCard, F1)', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: catalog })
    render(<BillingTiersCard />)

    // The AI overage switch carries the AI meter in its accessible name (§6: no two switches share a name).
    const overageToggles = await screen.findAllByRole('switch', { name: `${t('billingTiers.overageEnabled')}: ${t('billing.usage.plan.tier.aiTitle')}` })
    fireEvent.click(overageToggles[0])

    const saveBtn = await screen.findByRole('button', { name: t('common.save') })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-tiers', {
      overage: { ai_enabled: false },
    }))
  })

  it('PUTs the AI overage price without touching the enabled flag or the workflow meter', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: catalog })
    render(<BillingTiersCard />)

    const priceInput = await screen.findByLabelText(t('billingTiers.overageAiPrice'))
    fireEvent.change(priceInput, { target: { value: '15' } })

    const saveBtn = await screen.findByRole('button', { name: t('common.save') })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-tiers', {
      overage: { ai_price_cents: 15 },
    }))
  })

  it('clears upgrade_contact as an explicit null in the PUT body (F2)', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: catalog })
    render(<BillingTiersCard />)

    const contactInput = await screen.findByLabelText(t('billingTiers.upgradeContactLabel')) as HTMLInputElement
    await waitFor(() => expect(contactInput.value).toBe('mailto:sales@koios.example'))
    fireEvent.change(contactInput, { target: { value: '' } })
    expect(contactInput.value).toBe('')

    const saveBtn = await screen.findByRole('button', { name: t('common.save') })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-tiers', {
      upgrade_contact: null,
    }))
  })

  it('renders the unavailable copy on a 404 and shows no save button', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    render(<BillingTiersCard />)

    expect(await screen.findByText(t('billingTiers.unavailable'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('common.save') })).not.toBeInTheDocument()
  })

  it('PUTs the tenant assignment body', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    render(<BillingTiersCard />)

    const assignBtn = await screen.findByText('assign-tenant')
    fireEvent.click(assignBtn)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/tenants/t-1/billing-tiers', {
      ai_tier: 'pro',
      effective_from: '2026-09-01',
    }))
  })
})
