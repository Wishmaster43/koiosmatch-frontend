import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CreateErrorAlert from './CreateErrorAlert'

describe('CreateErrorAlert', () => {
  it('renders the error message with role=alert', () => {
    const message = 'Something went wrong'
    render(<CreateErrorAlert message={message} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(message)
  })

  it('applies the default inset (22px)', () => {
    const { container } = render(<CreateErrorAlert message="Error" />)
    const alert = container.querySelector('[role="alert"]')

    expect(alert).toHaveStyle({ margin: '0 22px 8px' })
  })

  it('applies a custom inset', () => {
    const { container } = render(<CreateErrorAlert message="Error" inset={24} />)
    const alert = container.querySelector('[role="alert"]')

    expect(alert).toHaveStyle({ margin: '0 24px 8px' })
  })
})
