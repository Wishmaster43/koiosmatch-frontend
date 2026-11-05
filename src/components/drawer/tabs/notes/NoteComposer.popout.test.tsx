/** NoteComposer · second-screen hand-over (split from NoteComposer.test.tsx; mock header duplicated, hoisted mocks cannot be shared). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const noteTypes = [{ value: 'general', label: 'Algemeen' }, { value: 'call', label: 'Bellen' }]

/**
 * NOTITIE-POPOUT-HANDOFF-1 (Danny 09/10-08): the pop-out icon moved OUT of the
 * FloatingPanel's title bar into this block's own title row — same place, same
 * 26x26 bordered button as the profile text — and it now hands the composed note
 * over instead of opening an empty second screen. This file owns the composer half:
 * where the icon is, what it hands over, and when it refuses to render at all.
 * The channel/ack half lives in hooks/useNotesPopout.test.ts + NotesTab.test.tsx.
 */
describe('NoteComposer · second-screen hand-over (NOTITIE-POPOUT-HANDOFF-1)', () => {
  // No i18next instance in this tree, so t('openSecondScreen') is the bare key.
  const popOutButton = () => screen.queryByRole('button', { name: 'openSecondScreen' })

  it('renders the icon in the note block, NOT in the panel title bar', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels}
      onPopOutDraft={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    const dragHandle = screen.getByRole('dialog').querySelector('[data-drag-handle]')!
    expect(dragHandle.querySelector('button[aria-label="openSecondScreen"]')).toBeNull()
    expect(popOutButton()).toBeInTheDocument()
  })

  it('hands over every field the recruiter filled in — type, channel, title, body, language', async () => {
    const user = userEvent.setup()
    const onPopOutDraft = vi.fn()
    const channels = [{ value: 'phone', label: 'Telefoon' }]
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={channels} labels={labels}
      onPopOutDraft={onPopOutDraft} onSave={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByText('Bellen'))
    await user.click(screen.getByText('Telefoon'))
    await user.click(screen.getByRole('button', { name: 'pick-german' }))
    await user.type(screen.getByLabelText('body'), 'Klant gebeld')
    await user.click(popOutButton()!)

    expect(onPopOutDraft).toHaveBeenCalledWith({ type: 'call', channel: 'phone', title: '', body: 'Klant gebeld', language: 'de' })
  })

  it('never closes itself on the click — the host closes it on the window\'s ack', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels}
      onPopOutDraft={vi.fn()} onSave={vi.fn()} onCancel={onCancel} />)
    await user.click(popOutButton()!)
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('is disabled while a hand-over is in flight (never fired twice)', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels}
      onPopOutDraft={vi.fn()} popOutPending onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(popOutButton()).toBeDisabled()
  })

  it('renders no icon at all while EDITING an existing note (§3, it would save a duplicate)', () => {
    render(<NoteComposer open initialNote={{ type: 'general', text: 'Existing' }} noteTypes={noteTypes} channels={[]}
      labels={labels} onPopOutDraft={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(popOutButton()).toBeNull()
  })

  it('renders no icon for a host without a popout route', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels}
      onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(popOutButton()).toBeNull()
  })

  it('seeds itself from a received draft — and stays a NEW note, so saving adds one', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<NoteComposer open initialNote={null} initialDraft={{ type: 'call', channel: 'phone', title: 'Belnotitie', body: 'Halve notitie', language: 'fr' }}
      noteTypes={noteTypes} channels={[]} labels={labels} onSave={onSave} onCancel={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Nieuwe notitie' })).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('Halve notitie')
    expect(screen.getByTestId('current-language')).toHaveTextContent('fr')
    await user.click(screen.getByTitle('Save'))
    expect(onSave).toHaveBeenCalledWith({ type: 'call', channel: 'phone', title: 'Belnotitie', body: 'Halve notitie', language: 'fr' })
  })
})
