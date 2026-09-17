/**
 * Test SubEntityModalFrame: header rendering, import card slot, alert slot, footer.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Building } from 'lucide-react'
import SubEntityModalFrame from './SubEntityModalFrame'

describe('SubEntityModalFrame', () => {
  const mockProps = {
    open: true,
    onClose: vi.fn(),
    ariaLabel: 'Add department',
    persistKey: 'test-modal',
    isEdit: false,
    title: 'Add Department',
    subtitle: 'Customer Name',
    icon: Building,
    iconColor: 'var(--color-violet)',
    iconBg: 'var(--color-violet-bg)',
    importOpen: false,
    setImportOpen: vi.fn(),
    importButtonTitle: 'Import CSV departments',
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
    cancelLabel: 'Cancel',
    submitLabel: 'Create',
    submitDisabled: false,
  }

  it('renders header with title and subtitle', () => {
    render(
      <SubEntityModalFrame {...mockProps}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    expect(screen.getByText('Add Department')).toBeInTheDocument()
    expect(screen.getByText('Customer Name')).toBeInTheDocument()
  })

  it('renders import button when not editing', () => {
    render(
      <SubEntityModalFrame {...mockProps}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    const importBtn = screen.getByRole('button', { name: /Import CSV departments/i })
    expect(importBtn).toBeInTheDocument()
  })

  it('hides import button when editing', () => {
    render(
      <SubEntityModalFrame {...{ ...mockProps, isEdit: true }}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    // Only the cancel/submit buttons should be in the footer
    const allButtons = screen.getAllByRole('button')
    const importBtns = allButtons.filter(btn => btn.textContent?.includes('departments'))
    expect(importBtns).toHaveLength(0)
  })

  it('renders form children', () => {
    render(
      <SubEntityModalFrame {...mockProps}>
        <div data-testid="form-content">Test form</div>
      </SubEntityModalFrame>
    )

    expect(screen.getByTestId('form-content')).toBeInTheDocument()
  })

  it('renders import card when importOpen and provided', () => {
    const importCard = <div data-testid="import-card">Import Card</div>
    render(
      <SubEntityModalFrame {...{ ...mockProps, importOpen: true }} importCard={importCard}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    expect(screen.getByTestId('import-card')).toBeInTheDocument()
  })

  it('hides import card when importOpen is false', () => {
    const importCard = <div data-testid="import-card">Import Card</div>
    render(
      <SubEntityModalFrame {...mockProps} importCard={importCard}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    expect(screen.queryByTestId('import-card')).not.toBeInTheDocument()
  })

  it('renders alert when provided', () => {
    const alert = <div data-testid="error-alert" role="alert">Error message</div>
    render(
      <SubEntityModalFrame {...mockProps} alert={alert}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    expect(screen.getByTestId('error-alert')).toBeInTheDocument()
  })

  it('toggles import open when button clicked', async () => {
    const setImportOpen = vi.fn()
    render(
      <SubEntityModalFrame {...{ ...mockProps, setImportOpen, importOpen: false }}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    const importBtn = screen.getByRole('button', { name: /Import CSV departments/i })
    await userEvent.click(importBtn)

    expect(setImportOpen).toHaveBeenCalledWith(true)
  })

  it('renders footer with cancel and submit buttons', () => {
    render(
      <SubEntityModalFrame {...mockProps}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create/i })).toBeInTheDocument()
  })

  it('disables submit button when submitDisabled is true', () => {
    render(
      <SubEntityModalFrame {...{ ...mockProps, submitDisabled: true }}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    const submitBtn = screen.getByRole('button', { name: /Create/i })
    expect(submitBtn).toBeDisabled()
  })

  it('calls onSubmit when submit button clicked', async () => {
    const onSubmit = vi.fn()
    render(
      <SubEntityModalFrame {...{ ...mockProps, onSubmit }}>
        <div>Form content</div>
      </SubEntityModalFrame>
    )

    const submitBtn = screen.getByRole('button', { name: /Create/i })
    await userEvent.click(submitBtn)

    expect(onSubmit).toHaveBeenCalled()
  })
})
