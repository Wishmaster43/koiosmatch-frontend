/**
 * MiniProgressBar — the 8px relative-load bar shared by RecruiterLoad and
 * sales' ActivityByOwnerList: the inner bar's width tracks `pct` verbatim.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MiniProgressBar from './MiniProgressBar'

describe('MiniProgressBar', () => {
  it('sizes the inner bar to the given pct', () => {
    const { container } = render(<MiniProgressBar pct={42} />)
    const track = container.firstElementChild as HTMLDivElement
    const bar = track.firstElementChild as HTMLDivElement
    expect(bar.style.width).toBe('42%')
  })

  it('renders a full bar at 100%', () => {
    const { container } = render(<MiniProgressBar pct={100} />)
    const track = container.firstElementChild as HTMLDivElement
    const bar = track.firstElementChild as HTMLDivElement
    expect(bar.style.width).toBe('100%')
  })
})
