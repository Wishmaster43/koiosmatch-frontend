/**
 * DrawerGlyphButton — behaviour: onClick fires. Byte-identity (rule F, DRY
 * round 11 DRAWERS): the rendered markup for the three distinct call-site
 * shapes (muted+opacity, danger+opacity, danger without opacity) matches the
 * exact attribute/style string the four consumers' inline copies produced at
 * HEAD, proven via react-dom/server (not jsdom, whose CSSStyleDeclaration
 * would expand/reorder the style string and hide the real key order).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import userEvent from '@testing-library/user-event'
import { GitMerge } from 'lucide-react'
import DrawerGlyphButton from './DrawerGlyphButton'

describe('DrawerGlyphButton', () => {
  it('clicking the button calls onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<DrawerGlyphButton onClick={onClick} title="Merge" tone="muted"><GitMerge size={14} /></DrawerGlyphButton>)
    await user.click(screen.getByRole('button', { name: 'Merge' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('title doubles as the aria-label (candidate/customer merge icon)', () => {
    render(<DrawerGlyphButton onClick={vi.fn()} title="Merge duplicate" tone="muted" opacity={0.8}><GitMerge size={14} /></DrawerGlyphButton>)
    expect(screen.getByTitle('Merge duplicate')).toBe(screen.getByRole('button', { name: 'Merge duplicate' }))
  })

  // Muted + opacity 0.8: candidates/customers merge icon (rule F).
  it('renders the muted opacity:0.8 tone verbatim', () => {
    const html = renderToStaticMarkup(<DrawerGlyphButton onClick={vi.fn()} title="Merge" tone="muted" opacity={0.8}><GitMerge size={14} /></DrawerGlyphButton>)
    const styleAttr = html.match(/^<button[^>]*style="([^"]*)"/)?.[1]
    expect(styleAttr).toBe('background:none;border:none;cursor:pointer;padding:4px;display:flex;color:var(--text-muted);opacity:0.8')
  })

  // Danger + opacity 0.7: candidates/customers archive+delete, matches archive (rule F).
  it('renders the danger opacity:0.7 tone verbatim', () => {
    const html = renderToStaticMarkup(<DrawerGlyphButton onClick={vi.fn()} title="Archive" tone="danger" opacity={0.7}><GitMerge size={14} /></DrawerGlyphButton>)
    const styleAttr = html.match(/^<button[^>]*style="([^"]*)"/)?.[1]
    expect(styleAttr).toBe('background:none;border:none;cursor:pointer;padding:4px;display:flex;color:var(--color-danger-text);opacity:0.7')
  })

  // Danger without an opacity prop: matches mark-deletion, outreach mark-deletion —
  // the opacity key never rendered at all (not opacity:1, not a trailing separator).
  it('renders the danger tone with no opacity property when opacity is omitted', () => {
    const html = renderToStaticMarkup(<DrawerGlyphButton onClick={vi.fn()} title="Delete" tone="danger"><GitMerge size={14} /></DrawerGlyphButton>)
    const styleAttr = html.match(/^<button[^>]*style="([^"]*)"/)?.[1]
    expect(styleAttr).toBe('background:none;border:none;cursor:pointer;padding:4px;display:flex;color:var(--color-danger-text)')
  })
})
