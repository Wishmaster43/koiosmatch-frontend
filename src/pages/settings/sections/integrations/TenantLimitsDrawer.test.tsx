/**
 * TenantLimitsDrawer — asserts the GET route on open, the cap+mode override PUT,
 * an approval POST (grant) and DELETE (revoke) — the four states plus every
 * mutation's method/route/body (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import i18n from '@/i18n'
import TenantLimitsDrawer from './TenantLimitsDrawer'
import type { AdminTenantLimitRow } from './limitsApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ns: 'settings', ...o })

const smRow: AdminTenantLimitRow = {
  connector: 'sm', label: 'Shiftmanager', window: 'month', used: 120, cap: 5000, cap_source: 'tenant',
  mode: 'signal', mode_effective: 'signal', mode_fixed: false, percent: 2, cap_reached: false, approval: null, tenant_settable: true,
}
const hfRow: AdminTenantLimitRow = {
  connector: 'hf', label: 'HelloFlex', window: 'month', used: 10, cap: 100, cap_source: 'platform',
  mode: 'signal', mode_effective: 'signal', mode_fixed: false, percent: 10, cap_reached: false,
  approval: { id: 'ap1', until: '2026-09-30', extra_cap: 200, approved_by_name: 'Danny' }, tenant_settable: true,
}
// Not tenant-scoped (contract §3: wa_web/anthropic/whatsapp/opencage 422 on approvals POST/DELETE) with an
// active approval already granted — the badge stays visible, the grant/revoke controls do not.
const waWebRow: AdminTenantLimitRow = {
  connector: 'wa_web', label: 'WhatsApp Web', window: 'day', used: 5, cap: 100, cap_source: 'platform',
  mode: 'block', mode_effective: 'block', mode_fixed: false, percent: 5, cap_reached: false,
  approval: { id: 'ap3', until: '2026-09-30', extra_cap: 50, approved_by_name: 'Danny' }, tenant_settable: false,
}
// opencage's mode is server-fixed to 'block' (contract §2 point 2) — the picker must
// never render, since any other mode 422s `limits.mode_fixed`.
const opencageRow: AdminTenantLimitRow = {
  connector: 'opencage', label: 'OpenCage geocoding', window: 'day', used: 120, cap: 9000, cap_source: 'tenant',
  mode: 'block', mode_effective: 'block', mode_fixed: true, percent: 1, cap_reached: false, approval: null, tenant_settable: true,
}

const renderDrawer = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <TenantLimitsDrawer tenantId="t1" tenantName="Yesway Flex" onClose={() => {}} />
  </QueryClientProvider>,
)

beforeEach(() => vi.clearAllMocks())

describe('TenantLimitsDrawer', () => {
  it('GETs the tenant limits on open and renders a row per connector', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [smRow] } })
    renderDrawer()
    expect(await screen.findByText('Shiftmanager')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/admin/tenants/t1/limits')
  })

  it('renders the load error state, never a raw server message', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'))
    renderDrawer()
    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it('renders the empty state when no row came back', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    renderDrawer()
    expect(await screen.findByText(t('limits.empty'))).toBeInTheDocument()
  })

  it('PUTs the cap override for the connector on save', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [smRow] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [smRow] } })
    const user = userEvent.setup()
    renderDrawer()
    const capInput = await screen.findByLabelText(t('limits.platform.capLabel', { label: 'Shiftmanager' }))
    await user.clear(capInput)
    await user.type(capInput, '8000')
    await user.tab()
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    expect(api.put).toHaveBeenCalledWith('/admin/tenants/t1/limits', { limits: [{ connector: 'sm', cap: 8000, mode: 'signal' }] })
  })

  it('POSTs a granted approval with euros converted to cents', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [smRow] } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'ap2' } } })
    const user = userEvent.setup()
    renderDrawer()
    await screen.findByText('Shiftmanager')
    const extraInput = screen.getByLabelText(t('limits.approval.extra_cap'))
    await user.type(extraInput, '250')
    const surchargeInput = screen.getByLabelText(t('limits.approval.surcharge'))
    await user.type(surchargeInput, '9,50')
    await user.click(screen.getByRole('button', { name: t('limits.approval.grant') }))
    expect(api.post).toHaveBeenCalledWith('/admin/tenants/t1/limits/sm/approvals', { until: null, extra_cap: 250, surcharge_cents: 950, note: null })
  })

  it('DELETEs a revoked approval after confirming', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [hfRow] } })
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    renderDrawer()
    await screen.findByText('HelloFlex')
    // The row's own Revoke button opens the ConfirmDialog; that dialog's confirm
    // action carries the generic "confirm" label (ConfirmDialog's default).
    await user.click(screen.getByRole('button', { name: t('limits.approval.revoke') }))
    await screen.findByText(t('limits.approval.revoke_confirm'))
    await user.click(screen.getByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))
    expect(api.delete).toHaveBeenCalledWith('/admin/tenants/t1/limits/hf/approvals/ap1')
  })

  it('shows a not-tenant-scoped connector\'s approval as a read-only badge, no grant/revoke controls', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [waWebRow] } })
    renderDrawer()
    await screen.findByText('WhatsApp Web')
    expect(screen.getByText(t('limits.not_tenant_scoped_notice'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('limits.approval.revoke') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('limits.approval.grant') })).not.toBeInTheDocument()
  })

  it('renders a mode_fixed connector\'s mode as read-only text, never a picker', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [opencageRow] } })
    renderDrawer()
    await screen.findByText('OpenCage geocoding')
    expect(screen.getByText(t('limits.mode.block'))).toBeInTheDocument()
    expect(document.querySelector('button[aria-haspopup="listbox"]')).not.toBeInTheDocument()
  })

  it('renders an inline error when the cap/mode PUT is rejected, never a silent failure', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [smRow] } })
    vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { message: 'Deze modus is niet toegestaan.' } } })
    const user = userEvent.setup()
    renderDrawer()
    const capInput = await screen.findByLabelText(t('limits.platform.capLabel', { label: 'Shiftmanager' }))
    await user.clear(capInput)
    await user.type(capInput, '8000')
    await user.tab()
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    expect(await screen.findByText('Deze modus is niet toegestaan.')).toBeInTheDocument()
  })
})
