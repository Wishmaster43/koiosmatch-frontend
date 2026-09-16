// BoardStateMessage — behaviour test: renders the given message text.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BoardStateMessage from './BoardStateMessage'

describe('BoardStateMessage', () => {
  it('renders the given message', () => {
    render(<BoardStateMessage message="Loading…" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
