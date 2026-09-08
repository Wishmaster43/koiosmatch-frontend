/**
 * SettingLookupPicker.test — Unit tests for the shared single-value lookup
 * picker component with 'none' option and conditional save callback.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingLookupPicker from './SettingLookupPicker'

describe('SettingLookupPicker', () => {
  const mockOnPick = vi.fn()
  const options = [
    { value: 'status_a', label: 'Status A' },
    { value: 'status_b', label: 'Status B' },
  ]

  it('renders none option with custom label', () => {
    render(
      <SettingLookupPicker
        options={options}
        value="none"
        onPick={mockOnPick}
        noneLabel="Geen"
      />
    )
    expect(screen.getByText('Geen')).toBeInTheDocument()
  })

  it('renders options correctly', () => {
    render(
      <SettingLookupPicker
        options={options}
        value="status_a"
        onPick={mockOnPick}
        noneLabel="Geen"
      />
    )
    // Trigger is shown with the current selection
    expect(screen.getByText('Status A')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(
      <SettingLookupPicker
        options={options}
        value="status_a"
        onPick={mockOnPick}
        disabled={true}
        noneLabel="Geen"
      />
    )
    const trigger = screen.getByRole('button')
    expect(trigger).toBeDisabled()
  })

  it('displays none label when value is "none"', () => {
    render(
      <SettingLookupPicker
        options={options}
        value="none"
        onPick={mockOnPick}
        noneLabel="Geen status"
      />
    )
    expect(screen.getByText('Geen status')).toBeInTheDocument()
  })

  it('respects custom width prop', () => {
    render(
      <SettingLookupPicker
        options={options}
        value="status_a"
        onPick={mockOnPick}
        width={200}
        noneLabel="Geen"
      />
    )
    // Width is passed to SearchSelect; verify component renders without error
    expect(screen.getByText('Status A')).toBeInTheDocument()
  })
})
