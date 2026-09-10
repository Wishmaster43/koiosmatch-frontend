/**
 * DrawerSearchField — behaviour: a typed value reaches onChange. Byte-identity
 * (rule F, DRY round 11 MATCHLISTS): the rendered markup for both the default
 * minWidth:0 frame (existing ContactsPanel/DepartmentsPanel consumers) and the
 * overridden minWidth:120 frame (the newly adopted sub-list toolbars) matches
 * the exact style string HEAD's own inline copies produced, proven via
 * react-dom/server (not jsdom, whose CSSStyleDeclaration would expand shorthand
 * and hide the real key order — the same method the round-10 verdict used).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import userEvent from '@testing-library/user-event'
import DrawerSearchField from './DrawerSearchField'

describe('DrawerSearchField', () => {
  it('typing in the input calls onChange with the new value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DrawerSearchField value="" onChange={onChange} placeholder="Search" />)
    await user.type(screen.getByRole('textbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('uses the placeholder text as both placeholder and aria-label', () => {
    render(<DrawerSearchField value="" onChange={vi.fn()} placeholder="Zoek kandidaten" />)
    expect(screen.getByPlaceholderText('Zoek kandidaten')).toBe(screen.getByRole('textbox', { name: 'Zoek kandidaten' }))
  })

  // Default (no minWidth prop): the existing ContactsPanel/DepartmentsPanel shape —
  // must stay byte-identical to before this round's minWidth prop was added.
  it('renders the default minWidth:0 frame verbatim when minWidth is omitted', () => {
    const html = renderToStaticMarkup(<DrawerSearchField value="" onChange={vi.fn()} placeholder="Search" />)
    const styleAttr = html.match(/^<div style="([^"]*)"/)?.[1]
    expect(styleAttr).toBe(
      'display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:8px'
    )
  })

  // Overridden minWidth:120 (DRY round 11 MATCHLISTS): reproduces the candidates/
  // customers/vacancies sub-list toolbar's own inline object byte-for-byte, same
  // key order (minWidth stays in its original 5th position — object spread keeps
  // an existing key's position when only its value is reassigned).
  it('renders the minWidth:120 frame verbatim when minWidth is overridden (rule F)', () => {
    const html = renderToStaticMarkup(<DrawerSearchField value="" onChange={vi.fn()} placeholder="Search" minWidth={120} />)
    const styleAttr = html.match(/^<div style="([^"]*)"/)?.[1]
    expect(styleAttr).toBe(
      'display:flex;align-items:center;gap:8px;flex:1;min-width:120px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:8px'
    )
  })

  it('renders the input verbatim (rule F): value/onChange/placeholder/aria-label/style order', () => {
    const html = renderToStaticMarkup(<DrawerSearchField value="" onChange={vi.fn()} placeholder="Search" />)
    const inputStyleAttr = html.match(/<input[^>]*style="([^"]*)"/)?.[1]
    expect(inputStyleAttr).toBe('flex:1;border:none;background:transparent;outline:none;font-size:12px;color:var(--text)')
  })
})
