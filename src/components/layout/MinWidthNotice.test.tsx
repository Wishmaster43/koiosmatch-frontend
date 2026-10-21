import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const below = vi.hoisted(() => ({ value: true }))
vi.mock('@/hooks/useViewportBelow', () => ({ useViewportBelow: () => below.value }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import MinWidthNotice from './MinWidthNotice'

describe('MinWidthNotice', () => {
  beforeEach(() => { below.value = true; window.sessionStorage.clear() })

  it('renders the notice below desktop width', () => {
    render(<MinWidthNotice />)
    expect(screen.getByText('minWidth.notice')).toBeTruthy()
  })

  it('renders nothing at desktop width', () => {
    below.value = false
    const { container } = render(<MinWidthNotice />)
    expect(container.firstChild).toBeNull()
  })

  it('dismiss hides the notice and sets the session flag', () => {
    render(<MinWidthNotice />)
    fireEvent.click(screen.getByText('minWidth.dismiss'))
    expect(screen.queryByText('minWidth.notice')).toBeNull()
    expect(window.sessionStorage.getItem('km_min_width_dismissed')).toBe('1')
  })

  it('stays hidden when already dismissed this session', () => {
    window.sessionStorage.setItem('km_min_width_dismissed', '1')
    const { container } = render(<MinWidthNotice />)
    expect(container.firstChild).toBeNull()
  })
})
