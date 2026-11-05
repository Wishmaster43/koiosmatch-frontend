/**
 * MatchApprovalSettings — approval mode moved from the vacancies matching screen.
 * Wire: GET/PUT /settings/matching { approval_mode }.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import MatchApprovalSettings from './MatchApprovalSettings'

// Keep the real unwrap (importActual); only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> }
const st = (key: string) => i18n.t(key, { ns: 'settings' })

// The matching object under the usual {data} envelope.
function mockGet(approval_mode = 'on_deviation') {
  api.get.mockResolvedValue({ data: { data: { strictness: 'balanced', approval_mode } } })
  api.put.mockResolvedValue({ data: {} })
}

afterEach(() => vi.clearAllMocks())

describe('MatchApprovalSettings', () => {
  // Partial PUT straight from the click: assert route + body.
  it('PUTs /settings/matching with only the picked approval_mode', async () => {
    const user = userEvent.setup()
    mockGet()
    render(<MatchApprovalSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.approval.always'))).toBeInTheDocument())

    await user.click(screen.getByText(st('matching.approval.always')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/matching', { approval_mode: 'always' }))
  })

  // The chosen mode reads as chosen via the §4 success pair.
  it('paints the chosen approval mode in the success pair', async () => {
    mockGet('always')
    render(<MatchApprovalSettings />)
    await waitFor(() => expect(screen.getByText(st('matching.approval.always'))).toBeInTheDocument())

    const active = screen.getByText(st('matching.approval.always')).closest('[role="radio"]') as HTMLElement
    const inactive = screen.getByText(st('matching.approval.off')).closest('[role="radio"]') as HTMLElement
    expect(active.style.background).toBe('var(--color-success-bg)')
    expect(active.style.border).toBe('1px solid var(--color-success)')
    expect(inactive.style.background).toBe('var(--surface)')
  })

  // A failed GET shows the error and no control, so defaults never overwrite the real value.
  it('shows the load error and no segmented control when the GET rejects', async () => {
    api.get.mockRejectedValue(new Error('boom'))
    render(<MatchApprovalSettings />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(st('statusList.loadError')))
    expect(screen.queryByRole('radio')).toBeNull()
    expect(api.put).not.toHaveBeenCalled()
  })
})
