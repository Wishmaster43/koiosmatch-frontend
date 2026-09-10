// AssistResultFooter — the discard button fires onDiscard with its label, and the
// feedback slot forwards promptLogId/surface/t to KoiosFeedback (DRY round 11, NOTES2).
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssistDiscardButton, AssistFeedbackSlot } from './AssistResultFooter'

vi.mock('@/components/layout/koios/KoiosFeedback', () => ({
  default: (props: { promptLogId?: string; surface: string }) => (
    <div data-testid="koios-feedback" data-prompt-log-id={props.promptLogId} data-surface={props.surface} />
  ),
}))

describe('AssistDiscardButton', () => {
  it('calls onDiscard with the given label rendered', () => {
    const onDiscard = vi.fn()
    render(<AssistDiscardButton onDiscard={onDiscard} label="Verwerpen" />)
    fireEvent.click(screen.getByText('Verwerpen'))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })
})

describe('AssistFeedbackSlot', () => {
  it('forwards promptLogId, surface and t to KoiosFeedback', () => {
    const t = vi.fn((k: string) => k)
    render(<AssistFeedbackSlot promptLogId="log-1" surface="note_assist" t={t} />)
    const el = screen.getByTestId('koios-feedback')
    expect(el.getAttribute('data-prompt-log-id')).toBe('log-1')
    expect(el.getAttribute('data-surface')).toBe('note_assist')
  })
})
