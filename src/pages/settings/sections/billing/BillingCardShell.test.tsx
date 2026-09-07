/**
 * BillingCardShell — tests for shared billing card chrome.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BillingCardShell from './BillingCardShell'

describe('BillingCardShell', () => {
  it('renders title', () => {
    render(
      <BillingCardShell
        phase="ready"
        title="Test Title"
        loadingLabel="Loading..."
        errorLabel="Error"
      />
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('renders subtitle when ready', () => {
    render(
      <BillingCardShell
        phase="ready"
        title="Title"
        subtitle="Test Subtitle"
        loadingLabel="Loading..."
        errorLabel="Error"
      />
    )

    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
  })

  it('renders loading label when loading', () => {
    render(
      <BillingCardShell
        phase="loading"
        title="Title"
        loadingLabel="Please wait..."
        errorLabel="Error"
      />
    )

    expect(screen.getByText('Please wait...')).toBeInTheDocument()
  })

  it('does not render subtitle or children when loading', () => {
    render(
      <BillingCardShell
        phase="loading"
        title="Title"
        subtitle="Subtitle"
        loadingLabel="Loading..."
        errorLabel="Error"
      >
        <div>Child Content</div>
      </BillingCardShell>
    )

    expect(screen.queryByText('Subtitle')).not.toBeInTheDocument()
    expect(screen.queryByText('Child Content')).not.toBeInTheDocument()
  })

  it('renders error label when error', () => {
    render(
      <BillingCardShell
        phase="error"
        title="Title"
        loadingLabel="Loading..."
        errorLabel="An error occurred"
      />
    )

    expect(screen.getByText('An error occurred')).toBeInTheDocument()
  })

  it('renders children when ready', () => {
    render(
      <BillingCardShell
        phase="ready"
        title="Title"
        loadingLabel="Loading..."
        errorLabel="Error"
      >
        <div>Ready Content</div>
      </BillingCardShell>
    )

    expect(screen.getByText('Ready Content')).toBeInTheDocument()
  })
})
