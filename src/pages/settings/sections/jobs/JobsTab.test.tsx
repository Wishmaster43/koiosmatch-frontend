/**
 * JobsTab — cancel states: a repeated cancel (404) shows the translated "already gone" copy,
 * and every cancel button is disabled while a cancel request is pending (REQUEST-ASSERT-1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import JobsTab from './JobsTab'
import { fetchJobsList, cancelJob } from './jobsApi'

vi.mock('./jobsApi', () => ({ fetchJobsList: vi.fn(), cancelJob: vi.fn() }))

const t = (key: string) => i18n.t(key, { ns: 'settings' })

// Raw axios-shaped paginator envelope, as unwrapList expects.
const page = (rows: unknown[]) => ({ data: { data: rows, total: rows.length, current_page: 1, last_page: 1, per_page: 25 } }) as never

afterEach(() => vi.clearAllMocks())

describe('JobsTab cancel', () => {
  // A 404 on DELETE /admin/jobs/{id} reads as "already gone", not as a raw error.
  it('shows the translated already-gone copy after a 404', async () => {
    vi.mocked(fetchJobsList).mockResolvedValue(page([{ id: '5', queue: 'default' }]))
    vi.mocked(cancelJob).mockRejectedValue({ response: { status: 404 } })
    render(<JobsTab />)
    await userEvent.click(await screen.findByRole('button', { name: t('jobs.cancel') }))
    expect(cancelJob).toHaveBeenCalledWith('5')
    expect(await screen.findByText(t('jobs.cancelGone'))).toBeInTheDocument()
  })

  // While the DELETE is pending the cancel button is disabled, and it re-enables afterwards.
  it('disables the cancel button while the request is pending', async () => {
    vi.mocked(fetchJobsList).mockResolvedValue(page([{ id: '4', queue: 'default' }]))
    let release: (v: unknown) => void = () => {}
    vi.mocked(cancelJob).mockReturnValue(new Promise((r) => { release = r }) as never)
    render(<JobsTab />)
    const btn = await screen.findByRole('button', { name: t('jobs.cancel') })
    await userEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    await act(async () => { release({ data: {} }) })
    await waitFor(() => expect(screen.getByRole('button', { name: t('jobs.cancel') })).toBeEnabled())
    expect(cancelJob).toHaveBeenCalledTimes(1)
  })
})
