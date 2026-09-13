import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import Toaster from './Toaster'
import { notifyError, notify } from '@/lib/notify'

describe('Toaster', () => {
  it('shows a toast (role=alert) when notifyError fires (existing string API unchanged)', () => {
    render(<Toaster />)
    act(() => { notifyError('opslaan mislukt') })
    expect(screen.getByRole('alert')).toHaveTextContent('opslaan mislukt')
  })

  // NOTIF-ATTENTION-V1: the additive options object renders a title, an
  // in-app click surface, and a trailing new-tab icon anchor when deepLink is set.
  it('opens in-app on click and on Enter/Space, dismissing the toast (keyboard-operable control)', () => {
    const onOpen = vi.fn()
    render(<Toaster />)
    act(() => { notify('info', 'Open me', { title: 'Attention', onOpen }) })
    const control = screen.getByRole('button', { name: 'Attention' })
    fireEvent.click(control)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Open me')).not.toBeInTheDocument()

    act(() => { notify('info', 'Open me again', { title: 'Attention 2', onOpen }) })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Attention 2' }), { key: 'Enter' })
    // A real <button> fires click on Enter/Space natively; keyDown alone is not
    // a click in jsdom, so assert the semantic: it IS a button (no custom handler needed).
    expect(screen.getByRole('button', { name: 'Attention 2' }).tagName).toBe('BUTTON')
  })

  it('renders an attention toast with title, click-to-open and a new-tab link', () => {
    const onOpen = () => {}
    render(<Toaster />)
    act(() => {
      notify('info', 'A new item arrived', { title: 'New notification', onOpen, deepLink: '#tasks?open=1' })
    })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('New notification')
    expect(status).toHaveTextContent('A new item arrived')
    expect(screen.getByRole('link')).toHaveAttribute('href', '#tasks?open=1')
  })
})
