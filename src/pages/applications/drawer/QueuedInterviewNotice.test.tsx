/** QueuedInterviewNotice: three states render their keys; the spinner shows only while queued. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import QueuedInterviewNotice from './QueuedInterviewNotice'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/ui/Spinner', () => ({ default: () => <span data-testid="spinner" /> }))

describe('QueuedInterviewNotice', () => {
  it.each([
    ['queued', 'interview.start.queued', true],
    ['capped', 'interview.start.queuedStillWaiting', false],
    ['skipped', 'interview.start.queuedSkipped', false],
  ] as const)('%s renders its key', (state, key, spinner) => {
    render(<QueuedInterviewNotice state={state} />)
    expect(screen.getByText(key)).toBeInTheDocument()
    expect(!!screen.queryByTestId('spinner')).toBe(spinner)
  })
})
