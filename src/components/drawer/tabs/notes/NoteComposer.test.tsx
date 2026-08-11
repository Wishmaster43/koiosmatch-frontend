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

/**
 * CHANNEL-PICKER-CONTRAST-1: the contact-channel row must SHOW which chip is
 * picked. Before this, every chip carried its own colour and selection was only a
 * stronger tint (16% vs 8%) — comparing a 16% blue against an 8% green is not
 * something the eye can do. Now only the selected chip wears its channel colour;
 * the rest are neutral, exactly like the Type row above it.
 */
describe('NoteComposer · channel picker shows the selection (CHANNEL-PICKER-CONTRAST-1)', () => {
  // Fixture channel colours are DATA, not styling: a tenant lookup delivers a raw
  // hex per channel over the API, so the test must feed the component one too.
  // eslint-disable-next-line no-restricted-syntax -- see above: API data, not a design token
  const EMAIL_COLOR = '#2563eb'
  // eslint-disable-next-line no-restricted-syntax -- see above: API data, not a design token
  const WHATSAPP_COLOR = '#16a34a'
  const channels = [
    { value: 'email', label: 'Email', color: EMAIL_COLOR },
    { value: 'whatsapp', label: 'WhatsApp', color: WHATSAPP_COLOR },
  ]
  const chip = (name: string) => screen.getByRole('button', { name: new RegExp(name) })

  it('renders every channel chip unselected and neutral when no channel is picked', () => {
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={channels} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    for (const ch of channels) {
      const btn = chip(ch.label)
      expect(btn).toHaveAttribute('aria-pressed', 'false')
      expect(btn).toHaveStyle({ background: 'var(--surface)', color: 'var(--text-muted)' })
      expect(btn.style.border).toBe('1px solid var(--border)')
      // The channel colour must NOT leak onto an unselected chip.
      expect(btn.style.background).not.toContain(EMAIL_COLOR)
    }
  })

  it('gives ONLY the selected chip its own channel colour, leaving the others on --surface', async () => {
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={channels} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)

    await user.click(chip('Email'))

    const selected = chip('Email')
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    // jsdom normalizes a hex colour to rgb() — toHaveStyle normalizes both sides.
    expect(selected).toHaveStyle({ color: EMAIL_COLOR })
    // jsdom rewrites the hex inside color-mix() to rgb() — assert on the parts
    // that carry the meaning: the channel colour, the 16%/50% tint, color-mix.
    expect(selected.style.background).toContain('color-mix(in srgb, rgb(37, 99, 235)')
    expect(selected.style.background).toContain('16%')
    // (jsdom's `border` shorthand parser drops the percentage, so only the
    // colour itself is assertable there — the point stands: it is NOT --border.)
    expect(selected.style.border).toContain('color-mix(in srgb, rgb(37, 99, 235)')
    expect(selected.style.border).not.toContain('var(--border)')
    expect(selected.style.fontWeight).toBe('600')

    const other = chip('WhatsApp')
    expect(other).toHaveAttribute('aria-pressed', 'false')
    expect(other).toHaveStyle({ background: 'var(--surface)', color: 'var(--text-muted)' })
    expect(other.style.fontWeight).toBe('500')
  })

  it('returns the chip to neutral (and aria-pressed=false) when the selection is toggled off', async () => {
    const user = userEvent.setup()
    render(<NoteComposer open initialNote={null} noteTypes={noteTypes} channels={channels} labels={labels} onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(chip('Email'))
    await user.click(chip('Email'))
    const btn = chip('Email')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveStyle({ background: 'var(--surface)' })
  })
})

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
