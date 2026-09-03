import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTextPrompt } from './useTextPrompt'

/**
 * Test wrapper component to exercise the hook and render its dialog.
 */
function TestComponent() {
  const { prompt, dialog } = useTextPrompt()

  return (
    <div>
      <button onClick={() => prompt('Test Title', 'Test Label', vi.fn())}>
        Open Prompt
      </button>
      {dialog}
    </div>
  )
}

describe('useTextPrompt', () => {
  it('renders the dialog when prompted', () => {
    render(<TestComponent />)

    // Initially no dialog title visible
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument()

    // Click to open
    const openBtn = screen.getByRole('button', { name: /open prompt/i })
    fireEvent.click(openBtn)

    // Now the dialog title should be visible
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('calls onSubmit with trimmed value when confirmed', () => {
    const onSubmit = vi.fn()

    function TestComponent2() {
      const { prompt, dialog } = useTextPrompt()

      return (
        <div>
          <button onClick={() => prompt('Title', 'Label', onSubmit)}>
            Open
          </button>
          {dialog}
        </div>
      )
    }

    render(<TestComponent2 />)

    const openBtn = screen.getByRole('button', { name: /open/i })
    fireEvent.click(openBtn)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '  Test Value  ' } })

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    // Should be called with trimmed value
    expect(onSubmit).toHaveBeenCalledWith('Test Value')
  })

  it('does not submit if value is empty or whitespace only', () => {
    const onSubmit = vi.fn()

    function TestComponent2() {
      const { prompt, dialog } = useTextPrompt()

      return (
        <div>
          <button onClick={() => prompt('Title', 'Label', onSubmit)}>
            Open
          </button>
          {dialog}
        </div>
      )
    }

    render(<TestComponent2 />)

    const openBtn = screen.getByRole('button', { name: /open/i })
    fireEvent.click(openBtn)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    // Should not be called
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('closes the dialog after submission', () => {
    const onSubmit = vi.fn()

    function TestComponent2() {
      const { prompt, dialog } = useTextPrompt()

      return (
        <div>
          <button onClick={() => prompt('Title', 'Label', onSubmit)}>
            Open
          </button>
          {dialog}
        </div>
      )
    }

    render(<TestComponent2 />)

    const openBtn = screen.getByRole('button', { name: /open/i })
    fireEvent.click(openBtn)

    expect(screen.getByText('Title')).toBeInTheDocument()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Test' } })

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    // Dialog should be closed (title no longer visible)
    expect(screen.queryByText('Title')).not.toBeInTheDocument()
  })

  it('resets input value for next prompt', () => {
    const onSubmit = vi.fn()

    function TestComponent2() {
      const { prompt, dialog } = useTextPrompt()

      return (
        <div>
          <button
            onClick={() => prompt('Title', 'Label', onSubmit)}
            data-testid="open-btn"
          >
            Open
          </button>
          {dialog}
        </div>
      )
    }

    render(<TestComponent2 />)

    // First prompt
    const openBtn = screen.getByTestId('open-btn')
    fireEvent.click(openBtn)

    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'First Value' } })

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    // Open a second prompt
    fireEvent.click(openBtn)

    // Input should be cleared
    const input2 = screen.getByRole('textbox') as HTMLInputElement
    expect(input2.value).toBe('')
  })

  it('disables the Confirm button while the field is empty', () => {
    render(<TestComponent />)

    const openBtn = screen.getByRole('button', { name: /open prompt/i })
    fireEvent.click(openBtn)

    // Freshly opened, the input is empty — Confirm must be disabled, never a
    // silent "confirmed" close on a blank field.
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    expect(confirmBtn).toBeDisabled()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Something' } })
    expect(confirmBtn).not.toBeDisabled()

    fireEvent.change(input, { target: { value: '   ' } })
    expect(confirmBtn).toBeDisabled()
  })

  it('wires the label to the input via a unique id, never a hardcoded DOM id', () => {
    render(<TestComponent />)

    const openBtn = screen.getByRole('button', { name: /open prompt/i })
    fireEvent.click(openBtn)

    const input = screen.getByRole('textbox') as HTMLInputElement
    const label = screen.getByText('Test Label')
    expect(label.getAttribute('for')).toBe(input.id)
    expect(input.id).not.toBe('text-prompt-input')
  })

  it('closes the dialog when cancelled', () => {
    const onSubmit = vi.fn()

    function TestComponent2() {
      const { prompt, dialog } = useTextPrompt()

      return (
        <div>
          <button onClick={() => prompt('Title', 'Label', onSubmit)}>
            Open
          </button>
          {dialog}
        </div>
      )
    }

    render(<TestComponent2 />)

    const openBtn = screen.getByRole('button', { name: /open/i })
    fireEvent.click(openBtn)

    expect(screen.getByText('Title')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)

    // Dialog should be closed
    expect(screen.queryByText('Title')).not.toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
