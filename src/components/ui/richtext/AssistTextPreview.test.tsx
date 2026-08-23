/**
 * AssistTextPreview — a short reply renders whole without chrome; a long reply
 * collapses behind an explicit expand/collapse toggle (ASSIST-LEESBAAR-1).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AssistTextPreview from './AssistTextPreview'

// Echo-the-key t() — asserts wiring, not copy (the real keys live in common.json ×5).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('AssistTextPreview', () => {
  it('renders a short reply as paragraphs without a toggle', () => {
    render(<AssistTextPreview text={'Eerste alinea.\n\nTweede alinea.'} />)
    expect(screen.getByText('Eerste alinea.')).toBeInTheDocument()
    expect(screen.getByText('Tweede alinea.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('collapses a long reply behind an expand/collapse toggle', async () => {
    const user = userEvent.setup()
    render(<AssistTextPreview text={'Lange alinea. '.repeat(80)} />)
    const toggle = screen.getByRole('button', { name: /notesAssist\.showAll/ })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: /notesAssist\.showLess/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /notesAssist\.showLess/ }))
    expect(screen.getByRole('button', { name: /notesAssist\.showAll/ })).toBeInTheDocument()
  })

  it('renders no New/Compare toggle when compareWith is absent', () => {
    render(<AssistTextPreview text="Hello world" />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('renders no toggle when compareWith is identical to the new text', () => {
    render(<AssistTextPreview text="Hello world" compareWith="Hello world" />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('renders no toggle above the diff performance guard', () => {
    const long = Array.from({ length: 2600 }, (_, i) => `w${i}`).join(' ')
    render(<AssistTextPreview text={long} compareWith="short" />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('shows the New/Compare toggle and diffs on a real change, defaulting to New', async () => {
    const user = userEvent.setup()
    render(<AssistTextPreview text="Hello brave world" compareWith="Hello old world" />)
    // Default view is New — plain text, no diff markup yet.
    expect(screen.getByText(/Hello brave world/)).toBeInTheDocument()
    const compareOption = screen.getByRole('radio', { name: 'notesAssist.viewCompare' })
    await user.click(compareOption)
    // Removed word carries its hidden label + strikethrough styling.
    const removed = screen.getByText('notesAssist.diffRemoved')
    expect(removed.parentElement).toHaveStyle({ textDecoration: 'line-through' })
    // Added word carries its hidden label + underline styling.
    const added = screen.getByText('notesAssist.diffAdded')
    expect(added.parentElement).toHaveStyle({ textDecoration: 'underline' })
  })
})
