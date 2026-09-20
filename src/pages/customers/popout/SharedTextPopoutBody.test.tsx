import { render } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import SharedTextPopoutBody from './SharedTextPopoutBody'

// Captures `assistGenerate` (the `generate` prop forwarded via TextPopoutEditor)
// so the pass-through to RichTextEditor is actually asserted, not just rendered.
const { generateArgs } = vi.hoisted(() => ({ generateArgs: { last: undefined as unknown } }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistGenerate }: { value: string; onChange: (html: string) => void; assistGenerate?: unknown }) => {
    generateArgs.last = assistGenerate
    return <textarea aria-label="editor" value={value} onChange={e => onChange(e.target.value)} />
  },
}))

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

  it('forwards the generate prop through to the editor', () => {
    render(
      <SharedTextPopoutBody
        loading={false} error={false} onRetry={vi.fn()}
        name="Test" subtitle="Test"
        text="Text" dirty={false} onChange={vi.fn()} onSave={async () => true}
        loadingLabel="" errorLabel="" retryLabel=""
        generate={{ entity: 'department' as const, id: 'id-123' }}
      />
    )
    expect(generateArgs.last).toEqual({ entity: 'department', id: 'id-123' })
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
