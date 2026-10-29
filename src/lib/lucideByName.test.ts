import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { Circle } from 'lucide-react'
import { lucideByName, lucideWrapperCache } from './lucideByName'

describe('lucideByName', () => {
  it('falls back synchronously on unknown, empty or null names', () => {
    expect(lucideByName('no-such-icon-xyz', Circle)).toBe(Circle)
    expect(lucideByName('', Circle)).toBe(Circle)
    expect(lucideByName(null, Circle)).toBe(Circle)
  })

  it('returns one cached wrapper per slug, alias names included', () => {
    const a = lucideByName('bar-chart-3', Circle)
    expect(a).not.toBe(Circle)
    expect(lucideByName('bar-chart-3', Circle)).toBe(a)
    expect(lucideWrapperCache.get('bar-chart-3')).toBe(a)
  })

  it('shows a same-sized blank first, then the svg once the lazy import resolves', async () => {
    const Icon = lucideByName('building-2', Circle)
    const { container } = render(createElement(Icon, { size: 20, 'data-testid': 'ico' } as never))
    const blank = container.querySelector('span[aria-hidden]') as HTMLElement | null
    expect(blank?.style.width).toBe('20px')
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull())
    expect(screen.queryByTestId('ico')).not.toBeNull()
  })

  it('the blank defaults to lucide\'s 24px when no size is given', () => {
    const Icon = lucideByName('house', Circle)
    const { container } = render(createElement(Icon, {} as never))
    const blank = container.querySelector('span[aria-hidden]') as HTMLElement | null
    expect(blank?.style.width).toBe('24px')
    expect(blank?.style.height).toBe('24px')
  })
})
