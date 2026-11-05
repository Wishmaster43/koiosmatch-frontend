/** NoteComposer · action items (split from NoteComposer.test.tsx; mock header duplicated, hoisted mocks cannot be shared). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NoteComposer from './NoteComposer'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }) }))
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  // Renders `toolbarExtra` like the real editor does — the dictation mic lives in
  // that slot now (Danny 08-08 "mic naast de taal"), so the mock must mount it.
  default: ({ value, onChange, language, onLanguageChange, fill, minHeight, toolbarExtra }: { value?: string; onChange: (v: string) => void; language?: string; onLanguageChange?: (l: string) => void; fill?: boolean; minHeight?: number; toolbarExtra?: React.ReactNode }) => (
    <div data-testid="rte-wrapper" data-fill={fill ? 'true' : 'false'} data-min-height={minHeight}>
      {toolbarExtra}
      <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
      <span data-testid="current-language">{language ?? ''}</span>
      <button type="button" onClick={() => onLanguageChange?.('de')}>pick-german</button>
    </div>
  ),
}))
// NoteAssistSection makes its own real POST-capable calls — stub it out here,
// it has its own dedicated test file.
vi.mock('./NoteAssistSection', () => ({ default: () => <div data-testid="assist-stub" /> }))
// useMyKoiosMode (ASSIST-SIDEPANEEL-1's autoRun gate) hits a real GET — this
// file only needs a stable wizard-mode default (API-CREDITS-1: no real calls
// from a test); the side panel's own auto/wizard behaviour has its own file.
vi.mock('@/pages/auth/shared', () => ({ useMyKoiosMode: () => ({ mode: 'wizard', autoMessages: false, loading: false, error: false, setMode: vi.fn(), setAutoMessages: vi.fn() }) }))

const labels = { newNote: 'Nieuwe notitie', edit: 'Bewerken', type: 'Type', channel: 'Kanaal', save: 'Save', cancel: 'Cancel' }

describe('NOTE-ACTION-ITEMS-1 · items persist with the note (CMBE 173ffbf7)', () => {
  it('the save carries the full wire definition — status/created stripped, ids kept, sort_order = index', () => {
    const onSave = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={[]} channels={[]} labels={labels} editorLabels={{}}
      initialDraft={{ type: 'general', channel: '', title: '', body: '', language: null,
        items: [
          { title: 'Bel kandidaat', type: 'task', due_date: '2026-09-01', note_excerpt: null, status: 'proposed' },
          { title: 'Plan intake', type: 'appointment', start: '2026-09-02T10:00', due_date: null, note_excerpt: null, status: 'executed', noteActionItemId: 'ai-7', created: { type: 'appointment', id: 'ap-1' } },
        ] } as never}
      onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const payload = onSave.mock.calls[0][0]
    expect(payload.action_items).toEqual([
      { title: 'Bel kandidaat', type: 'task', due_date: '2026-09-01', sort_order: 0 },
      { id: 'ai-7', title: 'Plan intake', type: 'appointment', start: '2026-09-02T10:00', sort_order: 1 },
    ])
  })

  // NOTE-BIRTH-STATUS-1 (api 02755adc): a NEW item the wizard already executed on the draft is
  // born with its status and created record; an item that has an id never carries them (the
  // execute route stays the only writer there), and a pending/proposed item carries neither.
  it('a new executed item is saved with status + created, a persisted one and a pending one without', () => {
    const onSave = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={[]} channels={[]} labels={labels} editorLabels={{}}
      initialDraft={{ type: 'general', channel: '', title: '', body: '', language: null,
        items: [
          { title: 'Bel over opdracht', type: 'appointment', start: '2026-09-22T12:00', due_date: null, note_excerpt: null, status: 'executed', created: { type: 'appointment', id: 'ap-9' } },
          { title: 'Plan intake', type: 'appointment', start: '2026-09-02T10:00', due_date: null, note_excerpt: null, status: 'executed', noteActionItemId: 'ai-7', created: { type: 'appointment', id: 'ap-1' } },
          { title: 'Stuur cv', type: 'task', due_date: '2026-09-03', note_excerpt: null, status: 'pending' },
        ] } as never}
      onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const payload = onSave.mock.calls[0][0]
    expect(payload.action_items).toEqual([
      { title: 'Bel over opdracht', type: 'appointment', start: '2026-09-22T12:00', status: 'executed', created: { type: 'appointment', id: 'ap-9' }, sort_order: 0 },
      { id: 'ai-7', title: 'Plan intake', type: 'appointment', start: '2026-09-02T10:00', sort_order: 1 },
      { title: 'Stuur cv', type: 'task', due_date: '2026-09-03', sort_order: 2 },
    ])
  })

  it('a reopened saved note seeds the panel from action_items, executed status included', () => {
    render(<NoteComposer open noteTypes={[]} channels={[]} labels={labels} editorLabels={{}} initialDraft={null}
      initialNote={{ id: 'n1', type: 'general', body: '', action_items: [
        { id: 'ai-9', title: 'Intake gepland', type: 'appointment', status: 'executed', created: { type: 'appointment', id: 'ap-2' } },
      ] } as never}
      onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Intake gepland')).toBeInTheDocument()
  })

  // CLAIM-1 (03-10 verifier fix): 'executing'/'declined' are STORED statuses
  // (BE NoteActionItem::STATUSES) — a reopened note used to collapse both to
  // 'pending' and show a "Bevestigen" confirm button that just re-sent an
  // already-claimed or declined item.
  it('a reopened note keeps a persisted executing item executing, no confirm button', () => {
    render(<NoteComposer open noteTypes={[]} channels={[]} labels={labels} editorLabels={{}} initialDraft={null}
      initialNote={{ id: 'n1', type: 'general', body: '', action_items: [
        { id: 'ai-10', title: 'Voorstel sturen', type: 'notification', status: 'executing' },
      ] } as never}
      onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('notesAssist.panel.statusExecuting')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'notesAssist.panel.confirm' })).not.toBeInTheDocument()
  })

  it('a reopened note keeps a persisted declined item declined, with its reason and a force-send button', () => {
    render(<NoteComposer open noteTypes={[]} channels={[]} labels={labels} editorLabels={{}} initialDraft={null}
      initialNote={{ id: 'n1', type: 'general', body: '', action_items: [
        { id: 'ai-11', title: 'Voorstel sturen', type: 'notification', status: 'declined', code: 'proposal_recently_sent', reason: 'Al verstuurd.' },
      ] } as never}
      onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('notesAssist.panel.statusDeclined')).toBeInTheDocument()
    expect(screen.getByText('notesAssist.execute.declined.proposal_recently_sent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notesAssist.execute.forceSend' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'notesAssist.panel.confirm' })).not.toBeInTheDocument()
  })
})
