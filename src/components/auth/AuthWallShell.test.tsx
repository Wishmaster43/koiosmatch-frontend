/** AuthWallShell — renders title, description, body and a working sign-out. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthWallShell from './AuthWallShell'

describe('AuthWallShell', () => {
  it('uses the shared auth backdrop token', () => {
    const { container } = render(<AuthWallShell icon={<i />} title="T" description="D" signOutLabel="Out" onSignOut={() => {}}><p>b</p></AuthWallShell>)
    expect(container.querySelector('[style*="--auth-backdrop"]')).not.toBeNull()
  })


  it('renders its slots and calls onSignOut', async () => {
    const onSignOut = vi.fn()
    render(<AuthWallShell icon={<i />} title="T" description="D" signOutLabel="Out" onSignOut={onSignOut}><p>body</p></AuthWallShell>)
    expect(screen.getByRole('heading', { name: 'T' })).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Out/ }))
    expect(onSignOut).toHaveBeenCalled()
  })
})
