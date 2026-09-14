/**
 * AdminLimitsTable — asserts the PUT request (route + body) on save, the
 * not-settable row rendering a notice instead of dead inputs, and that an
 * empty cap saves as null (no cap), never a silently-clamped zero.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import i18n from '@/i18n'
import AdminLimitsTable from './AdminLimitsTable'
import type { PlatformLimitRow } from './limitsApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ns: 'settings', ...o })

const rows: PlatformLimitRow[] = [
  // opencage's mode is server-fixed to 'block' (contract §2 point 2) — mode_fixed:true
  // so the row renders read-only text instead of a picker whose PUT would 422.
  { key: 'opencage', label: 'OpenCage geocoding', scope: 'platform', window: 'day', used: 120, cap: 9000, percent: 1, cap_reached: false, source: 'x', enforced: true, mode: 'block', mode_fixed: true, settable: true },
  { key: 'ai', label: 'Koios AI-tokens', scope: 'platform', window: 'day', used: 0, cap: null, percent: null, cap_reached: false, source: 'x', enforced: false, settable: false },
]

const renderTable = (r = rows) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminLimitsTable rows={r} /></QueryClientProvider>,
)

beforeEach(() => vi.clearAllMocks())

describe('AdminLimitsTable', () => {
  it('renders a not-settable row as a notice, never editable inputs', () => {
    renderTable()
    expect(screen.getByText(t('limits.not_settable_notice'))).toBeInTheDocument()
  })

  it('PUTs /admin/limits with the connector, cap and mode on save', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { platform: rows, tenants_near_cap: [], skipped_tenants: { count: 0, ids: [] } } } })
    const user = userEvent.setup()
    renderTable()
    const capInput = screen.getByLabelText(t('limits.platform.capLabel', { label: 'OpenCage geocoding' }))
    await user.clear(capInput)
    await user.type(capInput, '5000')
    await user.tab()
    await user.click(screen.getAllByRole('button', { name: t('common.save') })[0])
    expect(api.put).toHaveBeenCalledWith('/admin/limits', { limits: [{ connector: 'opencage', cap: 5000, mode: 'block' }] })
  })

  it('renders a mode_fixed connector\'s mode as read-only text, never a picker', () => {
    renderTable()
    expect(screen.getByText(t('limits.mode.block'))).toBeInTheDocument()
    expect(document.querySelector('button[aria-haspopup="listbox"]')).not.toBeInTheDocument()
  })

  it('renders an inline error when the PUT is rejected, never a silent failure', async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { message: 'Deze limiet kan niet worden ingesteld.' } } })
    const user = userEvent.setup()
    renderTable()
    const capInput = screen.getByLabelText(t('limits.platform.capLabel', { label: 'OpenCage geocoding' }))
    await user.clear(capInput)
    await user.type(capInput, '5000')
    await user.tab()
    await user.click(screen.getAllByRole('button', { name: t('common.save') })[0])
    expect(await screen.findByText('Deze limiet kan niet worden ingesteld.')).toBeInTheDocument()
  })

  it('saves an emptied cap as null, not a clamped zero', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { platform: rows, tenants_near_cap: [], skipped_tenants: { count: 0, ids: [] } } } })
    const user = userEvent.setup()
    renderTable()
    const capInput = screen.getByLabelText(t('limits.platform.capLabel', { label: 'OpenCage geocoding' }))
    await user.clear(capInput)
    await user.tab()
    await user.click(screen.getAllByRole('button', { name: t('common.save') })[0])
    expect(api.put).toHaveBeenCalledWith('/admin/limits', { limits: [{ connector: 'opencage', cap: null, mode: 'block' }] })
  })
})
