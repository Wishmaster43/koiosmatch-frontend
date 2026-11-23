/**
 * EraseWithPasswordDialog — the shared password-confirmed erase dialog
 * (CONTACT-ERASE-1-FE §1): confirm stays disabled until a password is typed,
 * Enter submits, a thrown 403/422 maps to the dialog's own copy, and any other
 * thrown error shows its own message via extractApiError.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import EraseWithPasswordDialog from './EraseWithPasswordDialog'

const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

describe('EraseWithPasswordDialog', () => {
  it('renders the title, intro and a disabled confirm until a password is typed', () => {
    render(<EraseWithPasswordDialog open title="Persoon wissen" intro="Dit kan niet ongedaan worden gemaakt."
      confirmLabel="Persoon wissen" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Persoon wissen' })).toBeInTheDocument()
    expect(screen.getByText('Dit kan niet ongedaan worden gemaakt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Persoon wissen' })).toBeDisabled()
  })

  it('enables confirm once a password is typed, and Enter submits with it', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />)

    const input = screen.getByLabelText(cm('eraseDialog.password'), { exact: false })
    await user.type(input, 'geheim{Enter}')

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('geheim'))
  })

  it('shows the wrongPassword copy on a 403', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue({ response: { status: 403 } })
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(cm('eraseDialog.password'), { exact: false }), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(cm('eraseDialog.wrongPassword'))
  })

  it('shows the passwordRequired copy on a 422', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue({ response: { status: 422 } })
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(cm('eraseDialog.password'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(cm('eraseDialog.passwordRequired'))
  })

  it('shows the server message on a generic failure, and clears it on retry', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValueOnce({ response: { data: { message: 'Netwerkfout' } } }).mockResolvedValueOnce(undefined)
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(cm('eraseDialog.password'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Netwerkfout')

    // Retry: the error clears and the second call goes through.
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('disables confirm and shows a busy submit label while awaiting onConfirm', async () => {
    const user = userEvent.setup()
    let resolve: () => void = () => {}
    const onConfirm = vi.fn(() => new Promise<void>(r => { resolve = r }))
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(cm('eraseDialog.password'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.getByRole('button', { name: /Confirm…/ })).toBeDisabled()
    resolve()
  })
})

// CANDIDATE-ERASE-FE-1 / ERASURE-OPEN-MATCH-1: the optional conflict step.
describe('EraseWithPasswordDialog · conflict step', () => {
  const conflict409 = { response: { status: 409, data: { code: 'candidate_has_open_match' } } }
  const conflict = { detect: (err: unknown) => ((err as { response?: { status?: number } })?.response?.status === 409 ? 'Open match.' : null), actionLabel: 'Close and erase' }

  it('shows the detected sentence with the action, disables the plain confirm, and Enter no longer submits', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValueOnce(conflict409).mockResolvedValueOnce(undefined)
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} conflict={conflict} />)

    const input = screen.getByLabelText(cm('eraseDialog.password'), { exact: false })
    await user.type(input, 'geheim')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledWith('geheim')

    expect(await screen.findByText('Open match.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    // Focus moves to the only way forward (the footer confirm the user clicked is disabled now).
    expect(screen.getByRole('button', { name: 'Close and erase' })).toHaveFocus()
    await user.type(input, '{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(1)

    // The escalation is the explicit click only, and carries the flag.
    await user.click(screen.getByRole('button', { name: 'Close and erase' }))
    await waitFor(() => expect(onConfirm).toHaveBeenLastCalledWith('geheim', { resolveConflict: true }))
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('a changed password clears the conflict and re-enables the plain confirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValueOnce(conflict409)
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} conflict={conflict} />)

    const input = screen.getByLabelText(cm('eraseDialog.password'), { exact: false })
    await user.type(input, 'geheim')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Open match.')).toBeInTheDocument()

    await user.type(input, '2')
    expect(screen.queryByText('Open match.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close and erase' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  })

  it('an error the detector does not recognise still maps to the usual copy, without the action', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValueOnce({ response: { status: 403 } })
    render(<EraseWithPasswordDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} conflict={conflict} />)

    await user.type(screen.getByLabelText(cm('eraseDialog.password'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(cm('eraseDialog.wrongPassword'))
    expect(screen.queryByRole('button', { name: 'Close and erase' })).toBeNull()
  })
})
