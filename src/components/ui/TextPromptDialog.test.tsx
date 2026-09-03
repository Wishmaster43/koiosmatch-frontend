import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TextPromptDialog from './TextPromptDialog'

describe('TextPromptDialog', () => {
  it('renders the title and label when open', () => {
    render(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        value=""
        onValueChange={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    expect(screen.getByText('Enter name')).toBeInTheDocument()
    expect(screen.getByText('Full name')).toBeInTheDocument()
  })

  it('does not render input when closed', () => {
    render(
      <TextPromptDialog
        open={false}
        title="Enter name"
        label="Full name"
        value=""
        onValueChange={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    // Input should not be in the DOM when closed
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('focuses the input on open and selects all text', async () => {
    const { rerender } = render(
      <TextPromptDialog
        open={false}
        title="Enter name"
        label="Full name"
        value="Initial text"
        onValueChange={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // Rerender with open=true
    rerender(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        value="Initial text"
        onValueChange={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    // Wait for the input to appear and be focused
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('Initial text'.length)
  })

  it('calls onValueChange when user types', () => {
    const onValueChange = vi.fn()
    render(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        value=""
        onValueChange={onValueChange}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'John' } })

    expect(onValueChange).toHaveBeenCalledWith('John')
  })

  it('calls onConfirm when Confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        value="Test"
        onValueChange={() => {}}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onConfirm when Enter is pressed in input', () => {
    const onConfirm = vi.fn()
    render(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        value="Test"
        onValueChange={() => {}}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        value="Test"
        onValueChange={() => {}}
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)

    expect(onCancel).toHaveBeenCalled()
  })

  it('renders placeholder when provided', () => {
    render(
      <TextPromptDialog
        open
        title="Enter name"
        label="Full name"
        placeholder="John Doe"
        value=""
        onValueChange={() => {}}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    const input = screen.getByPlaceholderText('John Doe')
    expect(input).toBeInTheDocument()
  })
})
