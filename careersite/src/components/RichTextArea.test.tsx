import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RichTextArea } from './RichTextArea'
import { strings } from '../strings'

// jsdom does not implement document.execCommand/queryCommandState at all (unlike a real
// browser, where they exist and mutate the DOM) — these tests stub them so the component's
// feature-detection guard still calls through, and assert the REAL command name/behavior
// the toolbar wires to, mirroring CLAUDE.md §13: assert the actual mechanism, not a callback.
let execCommandSpy: ReturnType<typeof vi.fn>
let queryCommandStateSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  execCommandSpy = vi.fn().mockReturnValue(true)
  queryCommandStateSpy = vi.fn().mockReturnValue(false)
  document.execCommand = execCommandSpy
  document.queryCommandState = queryCommandStateSpy
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RichTextArea', () => {
  it('reports the edited HTML via onChange when the user types', () => {
    const handleChange = vi.fn()
    render(<RichTextArea id="motivation" label="Motivatie" value="" onChange={handleChange} />)
    const editor = screen.getByRole('textbox', { name: 'Motivatie' })

    // Simulates real typing output: the browser has already mutated the DOM,
    // our onInput handler just reads it back out.
    editor.innerHTML = '<p>Gemotiveerde sollicitatie</p>'
    fireEvent.input(editor)

    expect(handleChange).toHaveBeenCalledWith('<p>Gemotiveerde sollicitatie</p>')
  })

  it('syncs an externally-changed value into the editor (e.g. a form reset)', () => {
    const handleChange = vi.fn()
    const { rerender } = render(<RichTextArea id="motivation" label="Motivatie" value="hello" onChange={handleChange} />)
    const editor = screen.getByRole('textbox', { name: 'Motivatie' })
    expect(editor.innerHTML).toBe('hello')

    rerender(<RichTextArea id="motivation" label="Motivatie" value="" onChange={handleChange} />)
    expect(editor.innerHTML).toBe('')
  })

  it.each([
    ['bold', strings.apply.richText.bold],
    ['italic', strings.apply.richText.italic],
    ['insertUnorderedList', strings.apply.richText.bulletList],
    ['insertOrderedList', strings.apply.richText.numberedList],
  ])('wires the %s toolbar button to the real browser command', (command, label) => {
    render(<RichTextArea id="motivation" label="Motivatie" value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(execCommandSpy).toHaveBeenCalledWith(command)
  })

  it('reflects the active command state on the button via aria-pressed', () => {
    queryCommandStateSpy.mockReturnValue(true)
    render(<RichTextArea id="motivation" label="Motivatie" value="" onChange={vi.fn()} />)
    const boldButton = screen.getByRole('button', { name: strings.apply.richText.bold })

    fireEvent.click(boldButton)

    expect(boldButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('never steals focus/selection away from the editor on toolbar mousedown', () => {
    render(<RichTextArea id="motivation" label="Motivatie" value="" onChange={vi.fn()} />)
    const boldButton = screen.getByRole('button', { name: strings.apply.richText.bold })
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    const prevented = !boldButton.dispatchEvent(event)

    expect(prevented).toBe(true)
  })

  it('runs bold via Cmd/Ctrl+B without needing the toolbar', () => {
    render(<RichTextArea id="motivation" label="Motivatie" value="" onChange={vi.fn()} />)
    const editor = screen.getByRole('textbox', { name: 'Motivatie' })

    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true })

    expect(execCommandSpy).toHaveBeenCalledWith('bold')
  })

  it('runs italic via Cmd/Ctrl+I without needing the toolbar', () => {
    render(<RichTextArea id="motivation" label="Motivatie" value="" onChange={vi.fn()} />)
    const editor = screen.getByRole('textbox', { name: 'Motivatie' })

    fireEvent.keyDown(editor, { key: 'i', metaKey: true })

    expect(execCommandSpy).toHaveBeenCalledWith('italic')
  })
})
