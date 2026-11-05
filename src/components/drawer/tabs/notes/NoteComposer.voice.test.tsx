/** NoteComposer · dictation mic (split from NoteComposer.test.tsx; mock header duplicated, hoisted mocks cannot be shared). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
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

// NOTITIE-VOICE-1: a minimal Web Speech API double — mirrors
// KoiosVoiceButton.test.tsx's own mock (jsdom ships neither the real API nor
// the vendor-prefixed one). Local to this file: each test file owns its mock.
interface MockResultEvent { resultIndex: number; results: Array<Array<{ transcript: string }>> }
// Final-segment double: the component only reads results whose isFinal is true.
const seg = (transcript: string, isFinal = true) => Object.assign([{ transcript }], { isFinal })

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

describe('NoteComposer · dictation mic (NOTITIE-VOICE-1)', () => {
  afterEach(() => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
  })

  // The mic button lives in the row directly above the RichTextEditor wrapper —
  // located by DOM position, never by its translated title (no i18next instance
  // in this test tree, mirrors KoiosVoiceButton.test.tsx's own t stub concern).
  // The mic lives INSIDE the editor's toolbarExtra slot now (Danny 08-08 "mic
  // naast de taal") — it is the only button in there carrying aria-pressed.
  const micButton = () => screen.getByTestId('rte-wrapper').querySelector('button[aria-pressed]')

  it('renders no mic on an unsupported browser (the shared HONEST GATE, inherited unchanged)', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(micButton()).toBeNull()
  })

  it('appends a dictated sentence escaped, continuing the last paragraph, never overwriting existing text', async () => {
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('body'), '<p>Klant gebeld.</p>')
    await user.click(micButton()!)
    expect(MockSpeechRecognition.lastInstance?.start).toHaveBeenCalledTimes(1)
    // Only FINAL segments reach the host (interim guesses are dropped upstream).
    act(() => { MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('<script>alert(1)</script>')] }) })

    // Escaped (never raw HTML — §7) and joined INTO the open paragraph, so a
    // dictated sentence continues the text instead of starting its own line
    // (Danny 08-08: dictation used to read as a column of fragments).
    expect(screen.getByLabelText('body')).toHaveValue(
      '<p>Klant gebeld. &lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('dictates in the CONTROLLED editor language, not a fixed/UI default', async () => {
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={[]} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)

    // Pick German via the stand-in language control (mirrors the save-payload test in NoteComposer.test.tsx).
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
