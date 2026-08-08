import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MatchRow } from '@/types/match'

// Key-echo t() (mirrors TerminateMatchModal.test.tsx precedent) — a stable
// assertion surface regardless of whether the reported i18n keys have landed
// in the locale files yet (the manager applies them after this delivery).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts?.date ? `${k}:${opts.date}` : k) }) }))
// @/lib/datetime's useDateFormat pulls in the REAL i18n init module (../i18n),
// which needs initReactI18next — not exported by the bare mock above (mirrors
// MatchModal.test.tsx's own documented reason: stub the hook directly instead
// of letting a real i18n init leak into this test's react-i18next mock).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})` }) }))

const match = { id: 'm1', status: 'open', endDate: '2026-08-01' } as unknown as MatchRow
const openEndedMatch = { id: 'm2', status: 'open', endDate: null } as unknown as MatchRow

afterEach(() => { vi.clearAllMocks() })

// api.post is module-scope-mocked fresh per test (mirrors TerminateMatchModal.test.tsx —
// each test gets its own module graph so one test's mock never leaks into the next).
async function setup(opts: { postResolves?: unknown; postRejects?: unknown } = {}) {
  vi.resetModules()
  vi.doMock('@/lib/api', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
    return {
      ...actual,
      default: {
        post: vi.fn(() => (opts.postRejects
          ? Promise.reject(opts.postRejects)
          : Promise.resolve(opts.postResolves ?? { data: { id: 'm1', status: 'open', end_date: '2026-09-01' } }))),
      },
    }
  })
  // notify is a real window-event dispatcher, not a spy — stub it so the success
  // toast is assertable (fresh per test, mirrors the api mock's own isolation).
  vi.doMock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
  const { default: FreshModal } = await import('./RenewMatchModal')
  const freshApi = (await import('@/lib/api')).default
  const freshNotify = await import('@/lib/notify')
  return { FreshModal, freshApi, freshNotify }
}

describe('RenewMatchModal (G04/MATCH-RENEWAL-1)', () => {
  it('disables Confirm until a new end date is picked', async () => {
    const { FreshModal } = await setup()
    render(<FreshModal match={match} onClose={vi.fn()} />)
    expect(screen.getByText('drawer.renew.confirm').closest('button')).toBeDisabled()
  })

  // §13 — a mutation test must assert the REQUEST, not only that a callback fired.
  it('POSTs the exact contract body { new_end_date } to /matches/{id}/renew', async () => {
    const { FreshModal, freshApi } = await setup()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={vi.fn()} />)
    // fireEvent (not userEvent.type): a native date input takes a whole value per
    // change, not a per-keystroke sequence (mirrors MatchModal.test.tsx precedent).
    fireEvent.change(screen.getByLabelText('drawer.renew.newEndDateLabel'), { target: { value: '2026-09-15' } })
    await user.click(screen.getByText('drawer.renew.confirm'))
    await waitFor(() => expect(freshApi.post).toHaveBeenCalledWith('/matches/m1/renew', { new_end_date: '2026-09-15' }))
  })

  it('accepts any date on an open-ended match (no current end_date to be after)', async () => {
    const { FreshModal, freshApi } = await setup({ postResolves: { data: { id: 'm2', status: 'open', end_date: '2026-01-01' } } })
    const user = userEvent.setup()
    render(<FreshModal match={openEndedMatch} onClose={vi.fn()} />)
    expect(screen.getByText('drawer.renew.noCurrentEndDate')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('drawer.renew.newEndDateLabel'), { target: { value: '2026-01-01' } })
    expect(screen.getByText('drawer.renew.confirm').closest('button')).not.toBeDisabled()
    await user.click(screen.getByText('drawer.renew.confirm'))
    await waitFor(() => expect(freshApi.post).toHaveBeenCalledWith('/matches/m2/renew', { new_end_date: '2026-01-01' }))
  })

  it('shows a client-side hint and disables Confirm when the picked date is not after the current end_date', async () => {
    const { FreshModal, freshApi } = await setup()
    render(<FreshModal match={match} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('drawer.renew.newEndDateLabel'), { target: { value: '2026-08-01' } })
    expect(screen.getByText('drawer.renew.mustBeAfterCurrent')).toBeInTheDocument()
    expect(screen.getByText('drawer.renew.confirm').closest('button')).toBeDisabled()
    expect(freshApi.post).not.toHaveBeenCalled()
  })

  it('keeps the modal open and surfaces the server\'s field error on a 422', async () => {
    const { FreshModal } = await setup({
      postRejects: { response: { status: 422, data: { errors: { new_end_date: ['De nieuwe einddatum moet na de huidige einddatum liggen.'] } } } },
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('drawer.renew.newEndDateLabel'), { target: { value: '2026-09-15' } })
    await user.click(screen.getByText('drawer.renew.confirm'))
    expect(await screen.findByText('De nieuwe einddatum moet na de huidige einddatum liggen.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('on a successful submit: hands the mapped match to onUpdate, notifies success, and closes', async () => {
    const { FreshModal, freshNotify } = await setup({
      postResolves: { data: { id: 'm1', status: 'open', end_date: '2026-09-15' } },
    })
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByLabelText('drawer.renew.newEndDateLabel'), { target: { value: '2026-09-15' } })
    await user.click(screen.getByText('drawer.renew.confirm'))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({ endDate: '2026-09-15' })))
    expect(freshNotify.notifySuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Annuleren closes without ever POSTing', async () => {
    const { FreshModal, freshApi } = await setup()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} />)
    await user.click(screen.getByText('common:cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(freshApi.post).not.toHaveBeenCalled()
  })
})
