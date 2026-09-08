/**
 * AdminLimitsSettings — asserts the real GET, the unenforced-row wording (a budget
 * signal never reads as a hard limit), the tenants-near-cap list in both contract
 * shapes, and the skipped-tenants notice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import i18n from '@/i18n'
import AdminLimitsSettings from './AdminLimitsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ns: 'settings', ...o })

const payload = (over: Record<string, unknown> = {}) => ({ data: { data: {
  platform: [
    { key: 'opencage', label: 'OpenCage geocoding', scope: 'platform', window: 'day', used: 9000, cap: 9000, percent: 100, cap_reached: true, source: 'x', enforced: true },
    { key: 'whatsapp', label: 'WhatsApp Business (Meta)', scope: 'platform', window: 'day', used: 58, cap: 50, percent: 116, cap_reached: true, source: 'y', enforced: false },
  ],
  tenants_near_cap: [
    { tenant_id: 't-1', tenant_name: 'Yesway Flex B.V.', connector: 'ai', percent: 92, cap_reached: false },
    { tenant_id: 't-2', tenant_name: 'Demo B.V.', rows: [{ key: 'workflow', label: 'Workflow-runs', percent: 85, cap_reached: false }] },
  ],
  skipped_tenants: { count: 0, ids: [] },
  ...over,
} } })

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminLimitsSettings /></QueryClientProvider>,
)

beforeEach(() => vi.clearAllMocks())

describe('AdminLimitsSettings', () => {
  it('GETs /admin/limits and renders the platform meters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(payload())
    renderPage()
    expect(await screen.findByText('OpenCage geocoding')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/admin/limits')
    expect(screen.getByText(t('limits.cap_reached'))).toBeInTheDocument()
  })

  it('an unenforced row at its cap reads as a signal, never as a hard limit', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(payload())
    renderPage()
    await screen.findByText('WhatsApp Business (Meta)')
    expect(screen.getByText(t('limits.signal_not_blocked'))).toBeInTheDocument()
    expect(screen.getAllByText(t('limits.cap_reached'))).toHaveLength(1)
  })

  it('lists tenants near their cap in both contract shapes', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(payload())
    renderPage()
    expect(await screen.findByText('Yesway Flex B.V.')).toBeInTheDocument()
    expect(screen.getByText('ai · 92%')).toBeInTheDocument()
    expect(screen.getByText('Demo B.V.')).toBeInTheDocument()
    expect(screen.getByText('Workflow-runs · 85%')).toBeInTheDocument()
  })

  it('shows the empty tenants line and the skipped notice', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(payload({ tenants_near_cap: [], skipped_tenants: { count: 2, ids: ['a', 'b'] } }))
    renderPage()
    expect(await screen.findByText(t('limits.tenantsAtLimitEmpty'))).toBeInTheDocument()
    expect(screen.getByText(t('limits.skipped_tenants_notice', { count: 2 }))).toBeInTheDocument()
  })
})
