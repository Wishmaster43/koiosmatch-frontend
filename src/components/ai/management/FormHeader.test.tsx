/**
 * FormHeader — test that icon, title, subtitle, and actions render correctly.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Brain } from 'lucide-react'
import { FormHeader } from './FormHeader'

describe('FormHeader', () => {
  it('renders icon, title, and right actions', () => {
    render(
      <FormHeader
        icon={Brain}
        title="Test Title"
        rightActions={<button>Action</button>}
      />
    )

    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <FormHeader
        icon={Brain}
        title="Title"
        titleSubtitle={<div>Subtitle Text</div>}
      />
    )

    expect(screen.getByText('Subtitle Text')).toBeInTheDocument()
  })

  it('wraps the title in its own div when wrapTitle is set, even without a subtitle', () => {
    render(<FormHeader icon={Brain} title="Title" wrapTitle />)

    const titleEl = screen.getByText('Title')
    // wrapTitle reproduces AgentForm's always-wrapped title div: the title's parent
    // holds only the title itself (the icon lives one level up, as a sibling of that wrapper).
    expect(titleEl.parentElement?.children).toHaveLength(1)
  })

  it('renders the title directly beside the icon when wrapTitle is not set and there is no subtitle', () => {
    render(<FormHeader icon={Brain} title="Title" />)

    const titleEl = screen.getByText('Title')
    // InterviewFlowsPanel's original DOM: no wrapper div, so the title's parent is the
    // icon row itself, holding both the icon container and the title.
    expect(titleEl.parentElement?.children).toHaveLength(2)
  })
})
