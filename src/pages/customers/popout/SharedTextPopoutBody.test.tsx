import { render } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import SharedTextPopoutBody from './SharedTextPopoutBody'

describe('SharedTextPopoutBody', () => {
  it('renders the PopoutShell with provided props', () => {
    const { container } = render(
      <SharedTextPopoutBody
        loading={false} error={false} onRetry={vi.fn()}
        name="Test Record" subtitle="Test Subtitle"
        text="Sample text" dirty={false} onChange={vi.fn()} onSave={async () => true}
        loadingLabel="Loading..." errorLabel="Error!" retryLabel="Retry"
      />
    )
    expect(container.textContent).toContain('Test Record')
    expect(container.textContent).toContain('Test Subtitle')
    expect(container.textContent).toContain('Sample text')
  })

  it('renders with generate prop when provided', () => {
    const { container } = render(
      <SharedTextPopoutBody
        loading={false} error={false} onRetry={vi.fn()}
        name="Test" subtitle="Test"
        text="Text" dirty={false} onChange={vi.fn()} onSave={async () => true}
        loadingLabel="" errorLabel="" retryLabel=""
        generate={{ entity: 'department' as const, id: 'id-123' }}
      />
    )
    expect(container).toBeDefined()
  })

  it('shows error state when error is true', () => {
    const { container } = render(
      <SharedTextPopoutBody
        loading={false} error={true} onRetry={vi.fn()}
        name="Test" subtitle="Test"
        text="Text" dirty={false} onChange={vi.fn()} onSave={async () => true}
        loadingLabel="" errorLabel="Error!" retryLabel="Retry"
      />
    )
    expect(container.textContent).toContain('Error!')
  })
})
