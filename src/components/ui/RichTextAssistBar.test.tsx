/**
 * RichTextAssistBar — the shared mic + Koios assist that rides EVERY rich-text
 * field (KOIOS-ASSIST-TEXTFIELDS, Danny 08-08; CMFE-KOIOS-CONSISTENCY-1, Danny
 * 09-08: the mode buttons are always visible — no click-to-expand step — and
 * 'actions' is a third mode, mirroring NoteAssistSection 1:1). §13: the assist
 * tests assert the actual REQUEST (route + body), never only that a callback
 * fired, and the dictation tests drive the real Web Speech state machine
 * through a mock recognizer — the seam a component mock would paper over.
 *
 * AssistActionsResultsPanel (the shared execute wizard) is stubbed here — it
 * has its own dedicated test file under components/ui/richtext/; this file
 * only proves the bar POSTs the right 'actions' request and hands a non-empty
 * result off to it.
 *
 * i18n note: the suite runs without loaded resources, so t('notesAssist.improve')
 * renders as its own key. Labels are therefore never asserted by text; stable
 * data-testids are. The keys themselves ARE shipped in nl/en/de/fr/es.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import RichTextAssistBar from './RichTextAssistBar'

// One shared axios mock — the bar's only network dependency.
const post = vi.fn()
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => post(...args) } }))

// The shared execute wizard has its own dedicated tests — stub it so this file
// stays focused on the bar's own request/apply/discard behaviour.
vi.mock('./richtext/AssistActionsResultsPanel', () => ({
  default: ({ items }: { items: { title: string }[] }) => (
    <div data-testid="actions-panel-stub">{items.map(i => i.title).join(', ')}</div>
  ),
}))

// Minimal recognizer stand-in: jsdom ships no Web Speech API, and the shared
// KoiosVoiceButton renders NOTHING without one (its honest gate).
class MockSpeechRecognition {
  static lastInstance: MockSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  start = vi.fn()
  stop = vi.fn()
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  constructor() { MockSpeechRecognition.lastInstance = this }
}
const finalSegment = (transcript: string) => ({ isFinal: true, 0: { transcript }, length: 1 })

// Host harness — the bar is controlled, so the test owns the value like a real
// editor host does.
function Host({ initial = '', modes }: { initial?: string; modes?: ('improve' | 'summarize' | 'actions')[] }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <RichTextAssistBar value={value} onChange={setValue} language="nl" modes={modes} />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('RichTextAssistBar', () => {
  beforeEach(() => { post.mockReset() })
  afterEach(() => { delete (window as { SpeechRecognition?: unknown }).SpeechRecognition })

  it('shows the mode buttons directly — no click-to-expand step (Danny 09-08)', () => {
    render(<Host initial="<p>tekst</p>" />)
    // No toggle to click first — every mode button is already in the document.
    expect(screen.getByTestId('rte-assist-improve')).toBeInTheDocument()
    expect(screen.getByTestId('rte-assist-summarize')).toBeInTheDocument()
    expect(screen.getByTestId('rte-assist-actions')).toBeInTheDocument()
  })

  it('POSTs /ai/koios/notes/assist with the field text, mode and language — and never applies before Overnemen', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { text: 'Nettere tekst' } })
    render(<Host initial="<p>ruwe tekst</p>" />)

    await user.click(screen.getByTestId('rte-assist-improve'))

    await waitFor(() => expect(screen.getByTestId('rte-assist-preview')).toHaveTextContent('Nettere tekst'))
    expect(post).toHaveBeenCalledWith('/ai/koios/notes/assist',
      { text: '<p>ruwe tekst</p>', language: 'nl', mode: 'improve' },
      expect.objectContaining({ timeout: 60000, quietStatuses: [402, 422, 503] }))
    // Review-only until the user accepts it.
    expect(screen.getByTestId('value')).toHaveTextContent('<p>ruwe tekst</p>')
  })

  it('Overnemen REPLACES the field for improve and APPENDS for summarize, escaping the model reply', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { text: '<b>stoute</b> samenvatting' } })
    render(<Host initial="<p>begin</p>" />)

    await user.click(screen.getByTestId('rte-assist-summarize'))
    await waitFor(() => expect(screen.getByTestId('rte-assist-apply')).toBeInTheDocument())
    await user.click(screen.getByTestId('rte-assist-apply'))

    // Appended below the existing text, with the model's markup neutralised (§7).
    expect(screen.getByTestId('value')).toHaveTextContent('<p>begin</p><p>&lt;b&gt;stoute&lt;/b&gt; samenvatting</p>')

    post.mockResolvedValue({ data: { text: 'herschreven' } })
    await user.click(screen.getByTestId('rte-assist-improve'))
    await waitFor(() => expect(screen.getByTestId('rte-assist-apply')).toBeInTheDocument())
    await user.click(screen.getByTestId('rte-assist-apply'))
    expect(screen.getByTestId('value')).toHaveTextContent('<p>herschreven</p>')
  })

  it('Verwerpen clears the suggestion and leaves the draft untouched', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { text: 'voorstel' } })
    render(<Host initial="<p>mijn tekst</p>" />)

    await user.click(screen.getByTestId('rte-assist-improve'))
    await waitFor(() => expect(screen.getByTestId('rte-assist-discard')).toBeInTheDocument())
    await user.click(screen.getByTestId('rte-assist-discard'))

    expect(screen.queryByTestId('rte-assist-preview')).toBeNull()
    expect(screen.getByTestId('value')).toHaveTextContent('<p>mijn tekst</p>')
  })

  it('POSTs mode: "actions" and hands a non-empty result off to the shared execute wizard', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { items: [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null }] } })
    render(<Host initial="<p>bel de kandidaat morgen terug</p>" />)

    await user.click(screen.getByTestId('rte-assist-actions'))

    expect(post).toHaveBeenCalledWith('/ai/koios/notes/assist',
      { text: '<p>bel de kandidaat morgen terug</p>', language: 'nl', mode: 'actions' },
      expect.objectContaining({ timeout: 60000, quietStatuses: [402, 422, 503] }))
    expect(await screen.findByTestId('actions-panel-stub')).toHaveTextContent('Bel terug')
    // The plain review-list idiom (Overnemen) is improve/summarize-only.
    expect(screen.queryByTestId('rte-assist-apply')).toBeNull()
  })

  it('an EMPTY actions result shows a calm "no items" notice, no execute wizard, no Overnemen', async () => {
    const user = userEvent.setup()
    post.mockResolvedValue({ data: { items: [] } })
    render(<Host initial="<p>niets te doen hier</p>" />)

    await user.click(screen.getByTestId('rte-assist-actions'))

    expect(await screen.findByText('notesAssist.noItems')).toBeInTheDocument()
    expect(screen.queryByTestId('actions-panel-stub')).toBeNull()
    expect(screen.queryByTestId('rte-assist-apply')).toBeNull()
  })

  it('disables the modes with a VISIBLE reason while the field is still empty (no fake affordance)', async () => {
    render(<Host initial="<p></p>" />)

    expect(screen.getByTestId('rte-assist-improve')).toBeDisabled()
    expect(screen.getByTestId('rte-assist-actions')).toBeDisabled()
    // The honest hint is rendered, not only a hover title.
    expect(screen.getByText('notesAssist.needsText')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('surfaces the server message on failure and stays retryable', async () => {
    const user = userEvent.setup()
    post.mockRejectedValue({ response: { status: 402, data: { message: 'Maandbudget bereikt' } } })
    render(<Host initial="<p>tekst</p>" />)

    await user.click(screen.getByTestId('rte-assist-improve'))

    await waitFor(() => expect(screen.getByText('Maandbudget bereikt')).toBeInTheDocument())
    expect(screen.getByTestId('rte-assist-improve')).toBeEnabled()
  })

  it('renders no assist row at all when the host offers no modes (mic-only hosts, e.g. the note composer)', () => {
    render(<Host initial="<p>tekst</p>" modes={[]} />)
    expect(screen.queryByTestId('rte-assist-panel')).toBeNull()
    expect(screen.queryByTestId('rte-assist-improve')).toBeNull()
  })

  it('renders no mic on a browser without the Web Speech API (the shared honest gate)', () => {
    const { container } = render(<Host />)
    expect(container.querySelector('button[aria-pressed]')).toBeNull()
  })

  it('appends dictated speech escaped, continuing the last paragraph, in the editor language', async () => {
    const user = userEvent.setup()
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
    const { container } = render(<Host initial="<p>Eerste zin.</p>" />)

    const mic = container.querySelector('button[aria-pressed]') as HTMLButtonElement
    await user.click(mic)
    expect(MockSpeechRecognition.lastInstance?.lang).toBe('nl-NL')
    // continuous = the session runs until the USER stops it (never a premature end).
    expect(MockSpeechRecognition.lastInstance?.continuous).toBe(true)

    act(() => {
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [finalSegment('<script>alert(1)</script>')] })
    })

    expect(screen.getByTestId('value'))
      .toHaveTextContent('<p>Eerste zin. &lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })
})
