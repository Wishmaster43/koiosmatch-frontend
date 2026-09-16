import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MatchRow } from '@/types/match'

// Key-echo t(), but with the interpolation VALUES appended so the GETALLEN-1
// formatting test below can assert on the actual (formatted) values passed in.
// Keeps the rest of the real module (initReactI18next etc.) — useNumberFormat's
// own useLocale() transitively loads '@/i18n', which needs the real export.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
  }
})

const match = { id: 'm1', status: 'open' } as unknown as MatchRow
const REASON_ROW = { value: 'end_of_contract', name: 'Einde contract' }

afterEach(() => { vi.clearAllMocks() })

// useMatchStopReasons is built on useCachedLookup, whose fetch/cache is MODULE
// SCOPE (one GET per session, shared across every mounted consumer — by design,
// see useCachedLookup's own doc comment). That means it would leak one test's
// cached reasons list into the next test's assertions unless each test gets a
// fresh module graph — mirrors useDocumentTypes.test.ts's resetModules pattern.
async function setup(opts: { reasons?: unknown[]; postResolves?: unknown; postRejects?: unknown } = {}) {
  vi.resetModules()
  vi.doMock('@/lib/api', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
    return {
      ...actual,
      default: {
        get: vi.fn(() => Promise.resolve({ data: opts.reasons ?? [] })),
        post: vi.fn(() => (opts.postRejects
          ? Promise.reject(opts.postRejects)
          : Promise.resolve(opts.postResolves ?? { data: { id: 'm1', status: 'closed' } }))),
      },
    }
  })
  // notify is a real window-event dispatcher, not a spy — stub it so the success
  // toast is assertable (fresh per test, mirrors the api mock's own isolation).
  vi.doMock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
  const { default: FreshModal } = await import('./TerminateMatchModal')
  const freshApi = (await import('@/lib/api')).default
  const freshNotify = await import('@/lib/notify')
  return { FreshModal, freshApi, freshNotify }
}

describe('TerminateMatchModal (MATCH-TERMINATE-1)', () => {
  it('shows an honest disabled notice — never a hardcoded list — when the tenant has no stop reasons configured', async () => {
    const { FreshModal } = await setup({ reasons: [] })
    render(<FreshModal match={match} onClose={vi.fn()} />)
    expect(await screen.findByText('drawer.terminate.noReasonsConfigured')).toBeInTheDocument()
    // The picker itself is replaced, not rendered as a fake-disabled dropdown.
    expect(screen.queryByRole('button', { name: 'drawer.terminate.reasonPlaceholder' })).toBeNull()
    expect(screen.getByText('drawer.terminate.confirm').closest('button')).toBeDisabled()
  })

  // §13 — a mutation test must assert the REQUEST, not only that a callback fired.
  it('POSTs the exact contract body { stop_reason, effective_date } to /matches/{id}/terminate', async () => {
    const { FreshModal, freshApi } = await setup({ reasons: [REASON_ROW] })
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'drawer.terminate.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Einde contract' }))
    await user.click(screen.getByText('drawer.terminate.confirm'))
    await waitFor(() => expect(freshApi.post).toHaveBeenCalledWith('/matches/m1/terminate', expect.objectContaining({
      stop_reason: 'end_of_contract',
      effective_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })))
  })

  it('keeps the modal open and surfaces the server\'s field error on a 422', async () => {
    const { FreshModal } = await setup({
      reasons: [REASON_ROW],
      postRejects: { response: { status: 422, data: { errors: { stop_reason: ['Ongeldige reden.'] } } } },
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'drawer.terminate.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Einde contract' }))
    await user.click(screen.getByText('drawer.terminate.confirm'))
    expect(await screen.findByText('Ongeldige reden.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  // Round 10 fix: HEAD's `if (body?.errors)` branch takes the field-error path even for
  // an EMPTY errors object — clears field errors, shows NO toast, and keeps the modal
  // open. A shared 422 extractor that collapsed "empty" and "absent" would show
  // a generic toast here instead — this pins the correct HEAD-mirroring behaviour.
  it('on a 422 with an empty errors object: shows no toast and keeps the modal open', async () => {
    const { FreshModal, freshApi, freshNotify } = await setup({
      reasons: [REASON_ROW],
      postRejects: { response: { status: 422, data: { errors: {} } } },
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'drawer.terminate.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Einde contract' }))
    await user.click(screen.getByText('drawer.terminate.confirm'))
    await waitFor(() => expect(freshApi.post).toHaveBeenCalledTimes(1))
    // Let the rejected promise's catch handler (and the setFieldErrors it fires) settle.
    await new Promise(resolve => setTimeout(resolve, 0))
    // The modal is still ON SCREEN (never closed) and the confirm button is still there.
    expect(screen.getByText('drawer.terminate.confirm')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(freshNotify.notifyError).not.toHaveBeenCalled()
    expect(freshNotify.notifySuccess).not.toHaveBeenCalled()
  })

  it('on a successful submit: hands the mapped match to onUpdate, notifies success, and closes', async () => {
    const { FreshModal, freshNotify } = await setup({
      reasons: [REASON_ROW],
      postResolves: { data: { id: 'm1', status: 'closed', candidate_name: 'Jan Jansen' } },
    })
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} onUpdate={onUpdate} />)
    await user.click(await screen.findByRole('button', { name: 'drawer.terminate.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Einde contract' }))
    await user.click(screen.getByText('drawer.terminate.confirm'))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({ status: 'closed' })))
    expect(freshNotify.notifySuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  // GETALLEN-1: the note counter renders locale-grouped numbers, never a raw
  // digit string — asserts the actual values passed to t(), not the mocked key.
  it('formats the note counter through the locale number formatter once over NOTE_COUNTER_FROM', async () => {
    const { FreshModal } = await setup({ reasons: [REASON_ROW] })
    render(<FreshModal match={match} onClose={vi.fn()} />)
    const textarea = await screen.findByLabelText('drawer.terminate.noteLabel')
    fireEvent.change(textarea, { target: { value: 'x'.repeat(1801) } })
    expect(await screen.findByText(/drawer\.terminate\.noteCounter/)).toHaveTextContent('"count":"1.801"')
    expect(screen.getByText(/drawer\.terminate\.noteCounter/)).toHaveTextContent('"max":"2.000"')
  })

  it('Annuleren closes without ever POSTing', async () => {
    const { FreshModal, freshApi } = await setup({ reasons: [REASON_ROW] })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FreshModal match={match} onClose={onClose} />)
    await screen.findByRole('button', { name: 'drawer.terminate.reasonPlaceholder' })
    await user.click(screen.getByText('common:cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(freshApi.post).not.toHaveBeenCalled()
  })
})
