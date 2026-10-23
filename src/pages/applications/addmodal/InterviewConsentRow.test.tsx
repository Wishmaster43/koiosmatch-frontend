import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InterviewConsentRow from './InterviewConsentRow'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('InterviewConsentRow', () => {
  // The box reflects the prop and reports the new state on click.
  it('renders unchecked and reports a tick', () => {
    const onChange = vi.fn()
    render(<InterviewConsentRow checked={false} onChange={onChange} />)
    const box = screen.getByLabelText('addModal.interviewConsent') as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
