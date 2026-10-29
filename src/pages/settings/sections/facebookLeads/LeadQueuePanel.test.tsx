/** LeadQueuePanel + the screen's queue deep link — render checks per status, candidate link and permission gating. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import LeadQueuePanel from './LeadQueuePanel'
import FacebookLeadsSettings from '../FacebookLeadsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
const mocked = vi.mocked(api, true)
const t = (key: string) => i18n.t(key, { ns: 'settings' })
const row = (id: number, status: string, candidate_id: string | null = null) => ({ id, form_id: `form-${id}`, status, attempts: 2, last_error_code: null, next_retry_at: null, escalated_at: null, retrieved_at: null, candidate_id, created_at: '2026-10-20T10:00:00Z' })

beforeEach(() => {
  mockUseAuth.mockReturnValue({ activeTenant: { id: 't' }, hasPermission: () => true })
  mocked.get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/summary')
    ? { data: { data: { pending: 1, retrieved: 1, rejected: 1, failed: 1, oldest_pending_at: '2026-10-19T08:00:00Z' } } }
    : { data: { data: [row(1, 'pending'), row(2, 'retrieved', 'cand-9'), row(3, 'failed'), row(4, 'rejected')], meta: { total: 4, last_page: 1 } } }) as never)
})
afterEach(() => vi.clearAllMocks())

describe('LeadQueuePanel', () => {
  it('renders counts, chips, candidate link only with candidate_id, retry only for retryable', async () => {
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText('form-1')).toBeTruthy())
    expect(screen.getByText(new RegExp(i18n.t('facebookLeads.queue.summary.pending', { ns: 'settings', count: 1, formatted: '1' })))).toBeTruthy()
    for (const s of ['failed', 'retrieved', 'rejected']) expect(screen.getAllByText(t(`facebookLeads.queue.status.${s}`)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(t('facebookLeads.queue.view'))).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: t('facebookLeads.queue.retry') })).toHaveLength(3)
    // The caption text is the translated key up to its date placeholder.
    const prefix = i18n.t('facebookLeads.queue.oldestPending', { ns: 'settings', date: '@@' }).split('@@')[0]
    expect(screen.getByText((text) => text.startsWith(prefix))).toBeTruthy()
  })

  // CONTRACT-FOLLOW-1: escalated_at is "rejection announced at" and only shows on rejected rows.
  it('labels the escalated_at column as rejection announced and fills it only for rejected rows', async () => {
    mocked.get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/summary')
      ? { data: { data: { pending: 0, retrieved: 0, rejected: 1, failed: 1, oldest_pending_at: null } } }
      : { data: { data: [{ ...row(4, 'rejected'), escalated_at: '2026-10-21T09:30:00Z' }, { ...row(3, 'failed'), escalated_at: '2026-10-21T09:30:00Z' }], meta: { total: 2, last_page: 1 } } }) as never)
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText('form-4')).toBeTruthy())
    expect(screen.getByText(t('facebookLeads.queue.col.rejectionAnnounced'))).toBeTruthy()
    const rejectedCells = within(screen.getByText('form-4').closest('tr') as HTMLElement).getAllByRole('cell').map((c) => c.textContent)
    const failedCells = within(screen.getByText('form-3').closest('tr') as HTMLElement).getAllByRole('cell').map((c) => c.textContent)
    expect(rejectedCells.filter((c) => c && c !== '—').length).toBeGreaterThan(failedCells.filter((c) => c && c !== '—').length)
  })

  it('hides retry without settings.update', async () => {
    mockUseAuth.mockReturnValue({ activeTenant: { id: 't' }, hasPermission: () => false })
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText('form-1')).toBeTruthy())
    expect(screen.queryByText(t('facebookLeads.queue.retry'))).toBeNull()
  })

  it('clears the status filter and refetches without a status param', async () => {
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText('form-1')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: t('facebookLeads.queue.filterLabel') }))
    // The menu option, not the table chip with the same label.
    fireEvent.click(screen.getAllByText(t('facebookLeads.queue.status.failed')).filter((el) => !el.closest('tr'))[0])
    await waitFor(() => expect(mocked.get).toHaveBeenCalledWith('/facebook-leads/receipts', { params: { per_page: 25, page: 1, status: 'failed' } }))
    fireEvent.click(screen.getByRole('button', { name: i18n.t('clear', { ns: 'common' }) }))
    await waitFor(() => expect(mocked.get).toHaveBeenLastCalledWith('/facebook-leads/receipts', { params: { per_page: 25, page: 1 } }))
  })

  it('clicking retry on a failed row posts the retry route for that receipt', async () => {
    mocked.post.mockResolvedValue({ data: { data: row(3, 'retrieved') } })
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText('form-3')).toBeTruthy())
    const failedRow = screen.getByText('form-3').closest('tr') as HTMLElement
    fireEvent.click(within(failedRow).getByRole('button', { name: t('facebookLeads.queue.retry') }))
    await waitFor(() => expect(mocked.post).toHaveBeenCalledWith('/facebook-leads/receipts/3/retry'))
  })

  it('shows a summary error banner while the receipts table still renders', async () => {
    mocked.get.mockImplementation((url: string) => (url.endsWith('/summary')
      ? Promise.reject(new Error('x'))
      : Promise.resolve({ data: { data: [row(1, 'pending')], meta: { total: 1, last_page: 1 } } })) as never)
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText(t('facebookLeads.queue.summaryLoadError'))).toBeTruthy())
    expect(screen.getByText('form-1')).toBeTruthy()
  })

  it('shows an error banner when loading fails', async () => {
    mocked.get.mockRejectedValue(new Error('x'))
    render(<LeadQueuePanel />)
    await waitFor(() => expect(screen.getByText(t('facebookLeads.queue.loadError'))).toBeTruthy())
  })
})

describe('FacebookLeadsSettings queue deep link', () => {
  it('opens on the queue tab with ?view=queue', async () => {
    window.location.hash = '#settings/integrations/facebook_leads?view=queue'
    render(<FacebookLeadsSettings />)
    await waitFor(() => expect(screen.getByText('form-1')).toBeTruthy())
    window.location.hash = ''
  })

  // A same-page deep link only fires hashchange: the open Connection tab must follow it.
  it('switches to the queue when the hash gains ?view=queue while mounted', async () => {
    window.location.hash = '#settings/integrations/facebook_leads'
    render(<FacebookLeadsSettings />)
    expect(screen.queryByText('form-1')).toBeNull()
    act(() => {
      window.location.hash = '#settings/integrations/facebook_leads?view=queue'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await waitFor(() => expect(screen.getByText('form-1')).toBeTruthy())
    window.location.hash = ''
  })
})
