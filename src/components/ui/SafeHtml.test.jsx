import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SafeHtml from './SafeHtml'

describe('SafeHtml', () => {
  it('renders safe formatting markup', () => {
    const { container } = render(<SafeHtml html="<b>hallo</b>" />)
    expect(container.querySelector('b')?.textContent).toBe('hallo')
  })

  it('strips script tags and inline event handlers (XSS)', () => {
    const { container } = render(
      <SafeHtml html={'<img src=x onerror="alert(1)"><script>alert(2)</script>veilig'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
    expect(container.textContent).toContain('veilig')
  })

  it('renders nothing harmful for null input', () => {
    const { container } = render(<SafeHtml html={null} />)
    expect(container.textContent).toBe('')
  })
})
