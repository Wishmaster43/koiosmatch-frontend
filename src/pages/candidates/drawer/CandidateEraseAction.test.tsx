/**
 * CandidateEraseAction (CANDIDATE-ERASE-FE-1): the header button opens the shared password dialog, the
 * confirm posts the anonymise, and the 409 candidate_has_open_match refusal (ERASURE-OPEN-MATCH-1)
 * renders the open-match sentence with the "close and erase" action that re-posts with the flag.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import CandidateEraseAction from './CandidateEraseAction'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/api')>()), default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notify: vi.fn() }))

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'candidates', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })
const c = { id: 'cand-1', name: 'Sem Blom' } as unknown as Candidate
const QUIET = { quietStatuses: [403, 409, 422] }

// Opens the dialog and types the password; returns the dialog scope.
async function openAndType(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: ct('erase.erasePerson') }))
  const dialog = screen.getByRole('dialog', { name: ct('erase.erasePerson') })
  await user.type(within(dialog).getByLabelText(cm('eraseDialog.password'), { exact: false }), 'geheim')
  return dialog
}

describe('CandidateEraseAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the erase button with its translated name and no dialog until clicked', () => {
    render(<CandidateEraseAction c={c} onErased={vi.fn()} />)
    expect(screen.getByRole('button', { name: ct('erase.erasePerson') })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the dialog with the named intro and POSTs the plain anonymise on confirm, then toasts and refreshes', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'ok' } })
    const onErased = vi.fn()
    const user = userEvent.setup()
    render(<CandidateEraseAction c={c} onErased={onErased} />)
    const dialog = await openAndType(user)
    expect(within(dialog).getByText(ct('erase.eraseIntro', { name: 'Sem Blom' }))).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: ct('erase.erasePerson') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/candidates/cand-1/erase', { password: 'geheim', mode: 'anonymize' }, QUIET))
    await waitFor(() => expect(onErased).toHaveBeenCalledWith('cand-1'))
    expect(notifySuccess).toHaveBeenCalledWith(ct('erase.personErased'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('on 409 candidate_has_open_match shows the open-match sentence and re-posts with close_open_matches on the action', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'candidate_has_open_match', message: 'Servertekst.', context: { open_matches: 1 } } } })
      .mockResolvedValueOnce({ data: { message: 'ok' } })
    const onErased = vi.fn()
    const user = userEvent.setup()
    render(<CandidateEraseAction c={c} onErased={onErased} />)
    const dialog = await openAndType(user)
    await user.click(within(dialog).getByRole('button', { name: ct('erase.erasePerson') }))

    expect(await within(dialog).findByText(ct('erase.openMatch', { count: 1 }))).toBeInTheDocument()
    expect(within(dialog).queryByText('Servertekst.')).toBeNull()
    expect(within(dialog).getByRole('button', { name: ct('erase.erasePerson') })).toBeDisabled()
    expect(onErased).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: ct('erase.closeMatchesAndErase') }))
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/candidates/cand-1/erase', { password: 'geheim', mode: 'anonymize', close_open_matches: true }, QUIET))
    expect(api.post).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(onErased).toHaveBeenCalledWith('cand-1'))
  })

  it('a wrong password keeps the dialog open with the wrongPassword copy and never refreshes', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { message: 'Wachtwoord onjuist.' } } })
    const onErased = vi.fn()
    const user = userEvent.setup()
    render(<CandidateEraseAction c={c} onErased={onErased} />)
    const dialog = await openAndType(user)
    await user.click(within(dialog).getByRole('button', { name: ct('erase.erasePerson') }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(cm('eraseDialog.wrongPassword'))
    expect(onErased).not.toHaveBeenCalled()
    expect(notifySuccess).not.toHaveBeenCalled()
  })
})
