/**
 * NoteComposer — POPUP-SLEEP-1 / NOTE-TAAL-1. §13: assert the SAVE payload
 * (language included per the picked value, undefined when untouched), the
 * popup open/close lifecycle, and the composerExtra new-note-only gate.
 * RichTextEditor is stubbed (mirrors CustomerNotesTab.contactLink.test.tsx's
 * own convention) — Tiptap itself is out of scope here; this file only proves
 * the composer wires language/body/type/channel through correctly, plus a
 * stand-in "language" control so the picked value is assertable without
 * depending on RichTextEditor's own internal select markup.
 *
 * RESIZE-GROWS-EDITOR (Danny 07-08): jsdom has no layout engine, so pixel
 * growth on drag-resize can't be asserted here — instead this proves the
 * STRUCTURAL wiring that makes it work in a real browser: `fill` reaches
 * RichTextEditor (its documented contract for "grow to fill a flex parent"),
 * and the panel uses `scrollBody={false}` with the editor's wrapper set to
 * flex:1 — the exact same contract already proven in the 11 other FloatingPanel
 * modals with a pinned footer (AddTaskModal etc.).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteComposer from './NoteComposer'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, language, onLanguageChange, fill, minHeight }: { value?: string; onChange: (v: string) => void; language?: string; onLanguageChange?: (l: string) => void; fill?: boolean; minHeight?: number }) => (
    <div data-testid="rte-wrapper" data-fill={fill ? 'true' : 'false'} data-min-height={minHeight}>
      <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
      <span data-testid="current-language">{language ?? ''}</span>
      <button type="button" onClick={() => onLanguageChange?.('de')}>pick-german</button>
    </div>
  ),
}))
// NoteAssistSection makes its own real POST-capable calls — stub it out here,
// it has its own dedicated test file.
vi.mock('./NoteAssistSection', () => ({ default: () => <div data-testid="assist-stub" /> }))

const labels = { newNote: 'Nieuwe notitie', edit: 'Bewerken', type: 'Type', channel: 'Kanaal', save: 'Save', cancel: 'Cancel' }
const noteTypes = [{ value: 'general', label: 'Algemeen' }, { value: 'call', label: 'Bellen' }]

// NOTITIE-VOICE-1: a minimal Web Speech API double — mirrors
// KoiosVoiceButton.test.tsx's own mock (jsdom ships neither the real API nor
// the vendor-prefixed one). Local to this file: each test file owns its mock.
interface MockResultEvent { resultIndex: number; results: Array<Array<{ transcript: string }>> }
class MockSpeechRecognition {
  static lastInstance: MockSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: MockResultEvent) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  constructor() { MockSpeechRecognition.lastInstance = this }
}

describe('NoteComposer · popup lifecycle', () => {
  it('renders nothing while closed', () => {
    render(<NoteComposer open={false} initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a dialog titled from labels.newNote for a new note', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Nieuwe notitie' })).toBeInTheDocument()
  })

  it('opens titled from labels.edit when editing an existing note', () => {
    render(<NoteComposer open initialNote={{ type: 'general', text: 'Existing' }} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Bewerken' })).toBeInTheDocument()
  })

  it('calls onCancel when the close (X) button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByTitle('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('NoteComposer · resize grows the editor (RESIZE-GROWS-EDITOR)', () => {
  it('passes fill + a real minHeight floor to RichTextEditor, so it is the item that grows', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    const rte = screen.getByTestId('rte-wrapper')
    expect(rte).toHaveAttribute('data-fill', 'true')
    expect(rte).toHaveAttribute('data-min-height', '160')
  })

  it('uses scrollBody={false} (a real dialog, content scrolls, footer pinned outside it)', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    // scrollBody=false renders the Save/Cancel footer as a SIBLING outside the
    // scrollable content wrapper (not inside it) — assert the footer's own
    // parent is NOT the same node the editor is nested under.
    const saveBtn = screen.getByTitle('Save')
    const rte = screen.getByTestId('rte-wrapper')
    const scrollArea = rte.closest('[style*="overflow"]')
    expect(scrollArea).not.toBeNull()
    expect(scrollArea?.contains(saveBtn)).toBe(false)
    expect(dialog.contains(saveBtn)).toBe(true)
  })
})

describe('NoteComposer · composerExtra (new-note-only gate)', () => {
  it('renders composerExtra for a NEW note', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels}
      composerExtra={<div>Link picker</div>} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Link picker')).toBeInTheDocument()
  })

  it('hides composerExtra while EDITING an existing note', () => {
    render(<NoteComposer open initialNote={{ type: 'general', text: 'Existing' }} noteTypes={noteTypes} channels={[]} labels={labels}
      composerExtra={<div>Link picker</div>} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText('Link picker')).toBeNull()
  })
})

describe('NoteComposer · save payload (NOTE-TAAL-1)', () => {
  it('saves with language undefined when the picker was never touched', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={onSave} onCancel={vi.fn()} />)
    await user.click(screen.getByTitle('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ language: undefined }))
  })

  it('saves with the picked language once the language control fires', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={onSave} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'pick-german' }))
    await user.click(screen.getByTitle('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ language: 'de' }))
  })

  it('prefills the language control from the note being edited', () => {
    render(<NoteComposer open initialNote={{ type: 'general', text: 'Existing', language: 'fr' }} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('current-language')).toHaveTextContent('fr')
  })

  it('saves the picked note type and body text alongside language', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={onSave} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Bellen'))
    await user.type(screen.getByLabelText('body'), 'Klant gebeld')
    await user.click(screen.getByTitle('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'call', body: 'Klant gebeld' }))
  })
})

describe('NoteComposer · dictation mic (NOTITIE-VOICE-1)', () => {
  afterEach(() => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
  })

  // The mic button lives in the row directly above the RichTextEditor wrapper —
  // located by DOM position, never by its translated title (no i18next instance
  // in this test tree, mirrors KoiosVoiceButton.test.tsx's own t stub concern).
  const micButton = () => screen.getByTestId('rte-wrapper').previousElementSibling?.querySelector('button') ?? null

  it('renders no mic on an unsupported browser (the shared HONEST GATE, inherited unchanged)', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(micButton()).toBeNull()
  })

  it('appends a dictated chunk to the body as an escaped paragraph, never overwriting existing text', async () => {
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('body'), 'Klant gebeld.')
    await user.click(micButton()!)
    expect(MockSpeechRecognition.lastInstance?.start).toHaveBeenCalledTimes(1)
    act(() => { MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [[{ transcript: '<script>alert(1)</script>' }]] }) })

    // Escaped (never raw HTML — §7) and appended, the typed text is still there.
    expect(screen.getByLabelText('body')).toHaveValue(
      'Klant gebeld.<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('dictates in the CONTROLLED editor language, not a fixed/UI default', async () => {
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)

    // Pick German via the stand-in language control (mirrors the save-payload test above).
    await user.click(screen.getByRole('button', { name: 'pick-german' }))
    await user.click(micButton()!)
    expect(MockSpeechRecognition.lastInstance?.lang).toBe('de-DE')
  })

  it('prefills the mic\'s dictation language from the note being edited', async () => {
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={{ type: 'general', text: 'Existing', language: 'fr' }} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(micButton()!)
    expect(MockSpeechRecognition.lastInstance?.lang).toBe('fr-FR')
  })
})
