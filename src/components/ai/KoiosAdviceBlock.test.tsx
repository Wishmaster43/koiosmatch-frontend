import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosAdviceBlock from './KoiosAdviceBlock'

// Shared fixture: two collapsed insight rows, mirroring a typical entity's advice.
const insights = [
  { type: 'Completeness', color: 'var(--color-warning)', text: 'Profile is 40% complete.' },
  { type: 'Engagement', color: 'var(--color-secondary)', text: 'No recent contact recorded.' },
]

describe('KoiosAdviceBlock', () => {
  it('renders the heading and keeps insight text collapsed by default', () => {
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)
    expect(screen.getByTitle('Koios AI')).toBeInTheDocument()
    expect(screen.getByText('Completeness')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
    expect(screen.queryByText('Profile is 40% complete.')).toBeNull()
  })

  it('reveals an insight on click and collapses it again on a second click', async () => {
    const user = userEvent.setup()
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} />)
    await user.click(screen.getByText('Completeness'))
    expect(screen.getByText('Profile is 40% complete.')).toBeInTheDocument()
    await user.click(screen.getByText('Completeness'))
    expect(screen.queryByText('Profile is 40% complete.')).toBeNull()
  })

  it('awaits the onRefresh callback and shows the analysing copy while it runs', async () => {
    const user = userEvent.setup()
    let resolveRefresh: () => void = () => {}
    const onRefresh = vi.fn(() => new Promise<void>(resolve => { resolveRefresh = resolve }))
    render(<KoiosAdviceBlock namespace="candidates" insights={insights} onRefresh={onRefresh} />)

    await user.click(screen.getByTitle('ai.refresh'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText('ai.analyzing')).toBeInTheDocument()

    resolveRefresh()
    await waitFor(() => expect(screen.queryByText('ai.analyzing')).toBeNull())
    expect(screen.getByText('Completeness')).toBeInTheDocument()
  })
})
