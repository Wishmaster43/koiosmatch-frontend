/**
 * PhaseChangeAppointmentWarning — V-appdetail-2's own confirm dialog. Proves the
 * AXIS-style warn banner renders (never a block), the phase name is interpolated
 * into the message, and confirm/cancel each fire exactly their own callback.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import PhaseChangeAppointmentWarning from './PhaseChangeAppointmentWarning'

describe('PhaseChangeAppointmentWarning', () => {
  it('renders a WARN banner (never block) naming the target phase', () => {
    render(<PhaseChangeAppointmentWarning phaseLabel="Uitgenodigd" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const banner = screen.getByTestId('action-rule-banner')
    expect(banner).toHaveAttribute('data-effect', 'warn')
    expect(banner).toHaveTextContent('Uitgenodigd')
  })

  it('confirm fires onConfirm, never onCancel', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<PhaseChangeAppointmentWarning phaseLabel="Uitgenodigd" onConfirm={onConfirm} onCancel={onCancel} />)
    await user.click(screen.getByText('Toch verplaatsen'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancel fires onCancel, never onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<PhaseChangeAppointmentWarning phaseLabel="Uitgenodigd" onConfirm={onConfirm} onCancel={onCancel} />)
    await user.click(screen.getByText('Annuleren'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
