/**
 * DescriptionCard · Koios assist modes (TASK-ASSIST-ACTIONS-1, Danny 14-08).
 * A new task's description is written as a briefing/conversation (subtasks
 * come out of it) so it opts INTO the third mode ('actions') rather than
 * inheriting RichTextAssistBar's shared improve+summarize-only default
 * (mirrors AttachmentsCard.test.tsx's proof for the vacancy note). The
 * Wizard/Auto switch is the SAME shared per-user preference the note popup
 * shows (`NoteKoiosModeToggle`) — mirrored here, not forked.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DescriptionCard from './DescriptionCard'
import type { TaskForm } from '../AddTaskModal'

// Stand-in for the Tiptap editor — `assistModes` surfaced as a data attribute
// so it can be asserted without mounting the real assist bar (mirrors
// AttachmentsCard.test.tsx / DescriptionTab.test.tsx convention).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistModes }: { value?: string; onChange: (v: string) => void; assistModes?: string[] }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)}
      data-assist-modes={assistModes ? assistModes.join(',') : ''} />
  ),
}))

// The Wizard/Auto switch loads a per-user resource via api — stub it with the
// real component's rendered shape so the test proves it is actually mounted,
// not that the wiring merely compiles.
vi.mock('@/components/drawer/tabs/notes/NoteKoiosModeToggle', () => ({
  default: () => <div data-testid="koios-mode-toggle" />,
}))

const t = ((key: string) => key) as unknown as import('i18next').TFunction

const baseForm: TaskForm = {
  type: '', title: '', assigneeId: '', status: '', due: '', teamId: '', dueTime: '',
  priority: '', description: '', candidateId: '', customerId: '', contactId: '',
}

describe('DescriptionCard · Koios assist (TASK-ASSIST-ACTIONS-1)', () => {
  it('offers all three assist modes, including Actiepunten, on a new task description', () => {
    render(<DescriptionCard t={t} form={baseForm} set={() => {}} />)
    expect(screen.getByTestId('rte')).toHaveAttribute('data-assist-modes', 'improve,summarize,actions')
  })

  it('renders the shared Wizard/Auto Koios-mode switch next to the card title', () => {
    render(<DescriptionCard t={t} form={baseForm} set={() => {}} />)
    expect(screen.getByTestId('koios-mode-toggle')).toBeInTheDocument()
  })
})
