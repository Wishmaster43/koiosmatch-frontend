/**
 * ResolveClaimDialog — shared "mark as not sent" dialog (CLAIM-RESOLVE-1):
 * confirm stays disabled until a reason is typed, a 409 known code maps to
 * its own copy, and any other thrown error shows its own message via
 * extractApiError.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ResolveClaimDialog from './ResolveClaimDialog'

const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

describe('ResolveClaimDialog', () => {
  it('renders the title, intro and a disabled confirm until a reason is typed', () => {
    render(<ResolveClaimDialog open title="Markeer als niet verzonden" intro="Verzending loopt vast."
      confirmLabel="Markeer als niet verzonden" onConfirm={vi.fn()} onClose={vi.fn()} persistKey="test-resolve" />)
    expect(screen.getByRole('dialog', { name: 'Markeer als niet verzonden' })).toBeInTheDocument()
    expect(screen.getByText('Verzending loopt vast.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Markeer als niet verzonden' })).toBeDisabled()
  })

  it('enables confirm once a reason is typed, and Enter submits with it', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<ResolveClaimDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />)

    const input = screen.getByLabelText(cm('resolveClaim.reason'), { exact: false })
    await user.type(input, 'Klant belde{Enter}')

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Klant belde'))
  })

  it('maps a known 409 code to its own copy', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue({ response: { status: 409, data: { code: 'contract_already_sent' } } })
    render(<ResolveClaimDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />)

    await user.type(screen.getByLabelText(cm('resolveClaim.reason'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(cm('resolveClaim.errors.contract_already_sent'))
  })

  it('shows the server message on a generic failure', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue({ response: { data: { message: 'Netwerkfout' } } })
    render(<ResolveClaimDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />)

    await user.type(screen.getByLabelText(cm('resolveClaim.reason'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Netwerkfout')
  })

  it('disables confirm and shows a busy submit label while awaiting onConfirm', async () => {
    const user = userEvent.setup()
    let resolve: () => void = () => {}
    const onConfirm = vi.fn(() => new Promise<void>(r => { resolve = r }))
    render(<ResolveClaimDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />)

    await user.type(screen.getByLabelText(cm('resolveClaim.reason'), { exact: false }), 'x')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.getByRole('button', { name: /Confirm…/ })).toBeDisabled()
    resolve()
  })

  it('starts fresh on reopen, never carrying over a previous reason/error (close/reopen regression)', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue({ response: { status: 409, data: { code: 'invoice_already_sent' } } })
    const { rerender } = render(
      <ResolveClaimDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />
    )
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(cm('resolveClaim.reason'), { exact: false }), 'x')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    // Close, then reopen — a fresh mount must not keep the typed reason or the 409 error.
    rerender(
      <ResolveClaimDialog open={false} title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />
    )
    rerender(
      <ResolveClaimDialog open title="t" intro="i" confirmLabel="Confirm" onConfirm={onConfirm} onClose={vi.fn()} persistKey="test-resolve" />
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(cm('resolveClaim.reason'), { exact: false })).toHaveValue('')
  })
})
