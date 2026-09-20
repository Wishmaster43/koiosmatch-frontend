/**
 * MfaSetupWizard — regression: a rejected `onFinished` on the terminal "Done"
 * action must not look identical to success. Before the fix, `finish` had no
 * catch: the busy spinner cleared and the user was left on the recovery-codes
 * screen with zero feedback.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MfaSetupWizard from './MfaSetupWizard'

vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr">{value}</div> }))
// Stable `t` reference across renders (repo-wide precedent uses a module-level
// constant for exactly this reason) — startSetup's useCallback depends on `t`,
// so a fresh mock function per render re-fires the mount effect every render.
const t = (k: string) => k
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))

async function completeSetupToRecovery(confirmMfa: () => Promise<unknown>) {
  const user = userEvent.setup()
  render(
    <MfaSetupWizard
      setupMfa={() => Promise.resolve({ otpauth_url: 'otpauth://x', secret: 'SECRET' })}
      confirmMfa={confirmMfa}
      onFinished={onFinished}
      onCancel={undefined}
    />,
  )
  await waitFor(() => screen.getByTestId('qr'))
  await user.type(screen.getByRole('textbox'), '123456')
  fireEvent.submit(screen.getByText('security.confirmEnable').closest('form') as HTMLFormElement)
  await waitFor(() => screen.getByText('security.done'))
  return user
}

let onFinished = vi.fn()

describe('MfaSetupWizard · Done error handling', () => {
  it('shows an error and keeps Done retryable when onFinished rejects', async () => {
    onFinished = vi.fn().mockRejectedValue(new Error('profile refresh failed'))
    const user = await completeSetupToRecovery(() => Promise.resolve({ recovery_codes: ['AAAA-1111'] }))

    await user.click(screen.getByText('security.done'))
    expect(await screen.findByRole('alert')).toHaveTextContent('security.errFinish')
    // Still on the recovery screen, Done still present and clickable.
    expect(screen.getByText('security.done')).toBeInTheDocument()
  })

  it('shows no error and calls onFinished once on a successful Done', async () => {
    onFinished = vi.fn().mockResolvedValue(undefined)
    const user = await completeSetupToRecovery(() => Promise.resolve({ recovery_codes: ['AAAA-1111'] }))

    await user.click(screen.getByText('security.done'))
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
