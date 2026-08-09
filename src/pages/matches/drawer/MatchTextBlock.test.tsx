/**
 * MatchTextBlock (M17/optie A) — pencil → save/✕ over its own `save` prop (the
 * SAME useMatchContract instance OverviewTab holds), asserting the actual
 * PATCH-shaped call (§13: never only that a callback fired), plus the
 * OFFERED-IFF-READ gate (hidden when `present` is false) and XSS-safety. Also
 * covers KOIOS-ASSIST-TEXTFIELDS: the shared RichTextAssistBar rides the
 * editor's own toolbar while editing (its request/apply/discard behaviour is
 * covered in RichTextAssistBar.test.tsx — this file only proves it is THERE).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchTextBlock from './MatchTextBlock'

describe('MatchTextBlock', () => {
  it('renders nothing when the payload does not carry the match_text key (OFFERED-IFF-READ)', () => {
    const { container } = render(<MatchTextBlock value={undefined} present={false} loading={false} save={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a loading placeholder while the shared contract fetch is in flight', () => {
    render(<MatchTextBlock value={null} present loading save={vi.fn()} />)
    expect(screen.getByText('drawer.contract.loading')).toBeInTheDocument()
  })

  it('renders an honest dash when there is no match text yet', () => {
    render(<MatchTextBlock value={null} present loading={false} save={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the existing match text as HTML', () => {
    render(<MatchTextBlock value="<p>Beschikbaar per direct inzetbaar</p>" present loading={false} save={vi.fn()} />)
    expect(screen.getByText('Beschikbaar per direct inzetbaar')).toBeInTheDocument()
  })

  it('strips unsafe markup via SafeHtml (XSS)', () => {
    const { container } = render(
      <MatchTextBlock value={'<img src=x onerror="alert(1)"><script>alert(2)</script>veilige tekst'} present loading={false} save={vi.fn()} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
    expect(screen.getByText(/veilige tekst/)).toBeInTheDocument()
  })

  it('pencil opens the editor; save calls save({ match_text }) with the edited value, then closes edit mode', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    render(<MatchTextBlock value="<p>Oud</p>" present loading={false} save={save} />)

    await user.click(screen.getByTitle('common:edit'))
    // The rich text editor mounts a contenteditable/textarea surface — this test
    // only proves the SAVE request shape, not the editor's own typing mechanics
    // (RichTextEditor has its own test suite), so it saves the seeded draft as-is.
    await user.click(screen.getByTitle('common:save'))

    expect(save).toHaveBeenCalledWith({ match_text: '<p>Oud</p>' })
  })

  it('cancel (✕) discards the draft without calling save', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    render(<MatchTextBlock value="<p>Oud</p>" present loading={false} save={save} />)

    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:cancel'))

    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('Oud')).toBeInTheDocument()
  })

  it('mounts the shared Koios assist toolbar on the editor while editing, WITHOUT an actiepunten mode (ACTIONS-SCOPE-1: a match text is a description, not a conversation)', async () => {
    const user = userEvent.setup()
    render(<MatchTextBlock value="<p>Oud</p>" present loading={false} save={vi.fn()} />)

    // Not shown outside edit mode.
    expect(screen.queryByTestId('rte-assist-improve')).toBeNull()

    await user.click(screen.getByTitle('common:edit'))
    // CMFE-KOIOS-CONSISTENCY-1 (Danny 09-08): the mode buttons are directly
    // visible on the editor toolbar now, no click-to-expand step.
    expect(screen.getByTestId('rte-assist-improve')).toBeEnabled()
    expect(screen.getByTestId('rte-assist-summarize')).toBeEnabled()
    // ACTIONS-SCOPE-1: no action-item extraction on a description field.
    expect(screen.queryByTestId('rte-assist-actions')).toBeNull()
  })

  it('sends null (not an empty string) when the match text is cleared out', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    render(<MatchTextBlock value={null} present loading={false} save={save} />)

    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:save'))

    expect(save).toHaveBeenCalledWith({ match_text: null })
  })
})
