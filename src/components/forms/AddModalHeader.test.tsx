/**
 * AddModalHeader — verify both consumer patterns work: candidates' title/hint wrapper
 * and vacancies' PageTitle as="span" titleElement. Behaviour tests (round 10 fix):
 * click close, click a pill, and the import button's conditional render + click — not
 * mere textContent presence checks.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import userEvent from '@testing-library/user-event'
import { PageTitle } from '@/components/ui/typography'
import AddModalHeader from './AddModalHeader'

// Candidates' HEAD key order (padding, borderBottom, display, alignItems, gap, flexShrink) —
// used as the default containerStyle for every test that does not exercise byte-identical
// serialization itself (round 10 fix: containerStyle is now a required per-consumer prop).
const CANDIDATES_STYLE = {
  padding: '18px 24px 14px', borderBottom: '1px solid var(--border)',
  display: 'flex' as const, alignItems: 'center' as const, gap: 16, flexShrink: 0,
}

describe('AddModalHeader', () => {
  const defaultProps = {
    value: 'lead',
    options: [{ value: 'lead', label: 'Lead' }, { value: 'candidate', label: 'Candidate' }],
    onChange: vi.fn(),
    onClose: vi.fn(),
    closeAriaLabel: 'Sluiten',
    ariaLabel: 'Kies fase',
    importButtonLabel: 'Import',
    containerStyle: CANDIDATES_STYLE,
  }

  it('renders candidates pattern (title + hint)', () => {
    render(
      <AddModalHeader
        {...defaultProps}
        title="Nieuwe kandidaat"
        hint="Vul verplichte velden in"
      />
    )

    expect(screen.getByText('Nieuwe kandidaat')).toBeInTheDocument()
    expect(screen.getByText('Vul verplichte velden in')).toBeInTheDocument()
  })

  it('renders candidates pattern with subtitle instead of hint', () => {
    render(
      <AddModalHeader
        {...defaultProps}
        title="Nieuwe kandidaat"
        subtitle="With subtitle"
      />
    )

    expect(screen.getByText('With subtitle')).toBeInTheDocument()
    expect(screen.queryByText('Vul verplichte velden in')).toBeNull()
  })

  it('renders vacancies pattern (titleElement override) and ignores title/hint', () => {
    render(
      <AddModalHeader
        {...defaultProps}
        title="Should be ignored"
        hint="Also ignored"
        titleElement={<PageTitle as="span">Custom title</PageTitle>}
      />
    )

    expect(screen.getByText('Custom title')).toBeInTheDocument()
    expect(screen.queryByText('Should be ignored')).toBeNull()
    expect(screen.queryByText('Also ignored')).toBeNull()
  })

  // Rule D — behaviour, not textContent: the close control actually calls onClose.
  it('clicking the close control calls onClose exactly once', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddModalHeader {...defaultProps} title="Test" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Sluiten' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Rule D — behaviour: clicking a non-active pill fires onChange with that pill's value.
  it('clicking a pill calls onChange with that pill\'s value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<AddModalHeader {...defaultProps} title="Test" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Candidate' }))
    expect(onChange).toHaveBeenCalledWith('candidate')
  })

  // Rule D — behaviour: the import button only renders when canImport is true,
  // and clicking it calls onToggleImport (the gate CLAUDE.md §3 calls "no fake affordance").
  it('renders the import button only when canImport is true, and clicking it calls onToggleImport', async () => {
    const onToggleImport = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <AddModalHeader {...defaultProps} title="Test" canImport={false} onToggleImport={onToggleImport} />
    )
    expect(screen.queryByText('Import')).toBeNull()

    rerender(
      <AddModalHeader {...defaultProps} title="Test" canImport onToggleImport={onToggleImport} />
    )
    const importButton = screen.getByText('Import').closest('button') as HTMLElement
    await user.click(importButton)
    expect(onToggleImport).toHaveBeenCalledTimes(1)
  })

  // Byte-identical serialization (rule F): each consumer supplies its OWN key order,
  // the component never re-orders it. Rendered via react-dom/server (NOT mounted
  // into jsdom): jsdom's live CSSStyleDeclaration expands the `padding` SHORTHAND
  // into four longhand properties on set, which would hide the real key order —
  // the same method the round-10 verdict used to measure this.
  it('applies the consumer-provided containerStyle object verbatim (own key order)', () => {
    const vacanciesStyle = {
      padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      display: 'flex' as const, alignItems: 'center' as const, gap: 16,
    }
    const html = renderToStaticMarkup(
      <AddModalHeader {...defaultProps} title="Test" containerStyle={vacanciesStyle} />
    )
    const styleAttr = html.match(/^<div style="([^"]*)"/)?.[1]
    expect(styleAttr).toBe(
      'padding:18px 22px 14px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:16px'
    )
  })

  // Negative type test (round 10 fix): importButtonLabel and ariaLabel are now REQUIRED
  // props (no hardcoded English default) — omitting either must fail to compile.
  it('requires importButtonLabel and ariaLabel at the type level (no hardcoded English default)', () => {
    // @ts-expect-error — importButtonLabel and ariaLabel are required string props;
    // assigning undefined must not typecheck (DRY round 10, MODALS).
    const el = <AddModalHeader {...defaultProps} title="Test" importButtonLabel={undefined} ariaLabel={undefined} />
    expect(el).toBeTruthy()
  })
})
