/**
 * ThreadComposer — WA-COMPOSER-1: the multi-line composer with the
 * bold/italic/strikethrough + emoji toolbar. Covers what the section-level
 * test can't isolate: the emoji panel open/close/focus contract and the
 * auto-grow row count.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThreadComposer from './ThreadComposer'

describe('ThreadComposer', () => {
  it('opens the emoji panel, closes it on Escape and returns focus to the textarea', async () => {
    const user = userEvent.setup()
    render(<ThreadComposer value="" onChange={() => {}} onSend={() => {}} sending={false} placeholder="Type…" />)

    await user.click(screen.getByRole('button', { name: 'conversations.composer.emoji' }))
    const panel = await screen.findByRole('dialog', { name: 'conversations.composer.emojiPanel' })
    expect(panel).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('Type…')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(textarea).toHaveFocus()
  })

  it('picking an emoji inserts it at the caret and keeps typing possible', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ThreadComposer value="hi " onChange={onChange} onSend={() => {}} sending={false} placeholder="Type…" />)
    const textarea = screen.getByPlaceholderText('Type…') as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    await user.click(screen.getByRole('button', { name: 'conversations.composer.emoji' }))
    await user.click(screen.getByRole('button', { name: '😀' }))
    expect(onChange).toHaveBeenCalledWith('hi 😀')
  })

  it('grows rows with newlines and caps at 6', () => {
    const { rerender } = render(<ThreadComposer value="one line" onChange={() => {}} onSend={() => {}} sending={false} placeholder="Type…" />)
    const textarea = screen.getByPlaceholderText('Type…') as HTMLTextAreaElement
    expect(textarea.rows).toBe(2)

    rerender(<ThreadComposer value={'a\nb\nc'} onChange={() => {}} onSend={() => {}} sending={false} placeholder="Type…" />)
    expect((screen.getByPlaceholderText('Type…') as HTMLTextAreaElement).rows).toBe(3)

    rerender(<ThreadComposer value={'a\nb\nc\nd\nd\nd\nd\nd\nd'} onChange={() => {}} onSend={() => {}} sending={false} placeholder="Type…" />)
    expect((screen.getByPlaceholderText('Type…') as HTMLTextAreaElement).rows).toBe(6)
  })

  it('Enter sends, Shift+Enter does not', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ThreadComposer value="hello" onChange={() => {}} onSend={onSend} sending={false} placeholder="Type…" />)
    const textarea = screen.getByPlaceholderText('Type…')
    await user.type(textarea, '{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
    await user.type(textarea, '{Enter}')
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
