/**
 * NoteFields — CHANNEL-PICKER-CONTRAST-1. The contact-channel row exists TWICE (here
 * and in NoteComposer, which is why it drifted); this file guards this copy so both
 * stay identical. The bug: every chip carried its own colour and "selected" was only
 * a stronger tint (16% vs 8%), so comparing a 16% blue against an 8% green made the
 * selection invisible. Now only the selected chip wears its channel colour and the
 * rest sit neutral on --surface/--border, exactly like the Type row above them.
 *
 * RichTextEditor and NoteAssistSection are stubbed (mirrors NoteComposer.test.tsx):
 * neither is in scope for a chip-styling assertion.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import NoteFields from './NoteFields'
import { useNoteFields } from './useNoteFields'
import type { NoteType, NotesLabels } from '../NotesTab'
import { chipInk } from '@/lib/tint'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('./NoteAssistSection', () => ({ default: () => <div data-testid="assist-stub" /> }))

const labels: NotesLabels = { type: 'Type', channel: 'Kanaal', save: 'Save', cancel: 'Cancel' }
const noteTypes: NoteType[] = [{ value: 'general', label: 'Algemeen' }]
// Fixture channel colours are DATA, not styling: a tenant lookup delivers a raw
// hex per channel over the API, so the test must feed the component one too.
// eslint-disable-next-line no-restricted-syntax -- see above: API data, not a design token
const EMAIL_COLOR = '#2563eb'
// eslint-disable-next-line no-restricted-syntax -- see above: API data, not a design token
const WHATSAPP_COLOR = '#16a34a'
const channels: NoteType[] = [
  { value: 'email', label: 'Email', color: EMAIL_COLOR },
  { value: 'whatsapp', label: 'WhatsApp', color: WHATSAPP_COLOR },
]

// Minimal host — NoteFields is presentational, the state lives in useNoteFields.
function Harness() {
  const fields = useNoteFields({}, noteTypes)
  return <NoteFields fields={fields} noteTypes={noteTypes} channels={channels} labels={labels} />
}

const chip = (name: string) => screen.getByRole('button', { name: new RegExp(name) })

describe('NoteFields · channel picker shows the selection (CHANNEL-PICKER-CONTRAST-1)', () => {
  it('renders every chip neutral and aria-pressed=false while no channel is picked', () => {
    render(<Harness />)
    for (const ch of channels) {
      const btn = chip(ch.label)
      expect(btn).toHaveAttribute('aria-pressed', 'false')
      expect(btn).toHaveStyle({ background: 'var(--surface)', color: 'var(--text-muted)' })
      expect(btn.style.border).toBe('1px solid var(--border)')
      expect(btn.style.background).not.toContain(EMAIL_COLOR)
    }
  })

  it('gives ONLY the selected chip its channel colour, leaving the others on --surface', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(chip('WhatsApp'))

    const selected = chip('WhatsApp')
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    // jsdom normalizes a hex colour to rgb() — toHaveStyle normalizes both sides.
    expect(selected).toHaveStyle({ color: chipInk(WHATSAPP_COLOR) })
    // jsdom rewrites the hex inside color-mix() to rgb() — assert on the parts
    // that carry the meaning: the channel colour, the 16%/50% tint, color-mix.
    expect(selected.style.background).toContain('color-mix(in srgb, rgb(22, 163, 74)')
    expect(selected.style.background).toContain('16%')
    // (jsdom's `border` shorthand parser drops the percentage, so only the
    // colour itself is assertable there — the point stands: it is NOT --border.)
    expect(selected.style.border).toContain('color-mix(in srgb, rgb(22, 163, 74)')
    expect(selected.style.border).not.toContain('var(--border)')
    expect(selected.style.fontWeight).toBe('600')

    const other = chip('Email')
    expect(other).toHaveAttribute('aria-pressed', 'false')
    expect(other).toHaveStyle({ background: 'var(--surface)', color: 'var(--text-muted)' })
  })

  it('keeps an icon on every chip, so the channel is recognisable without colour (§6)', () => {
    render(<Harness />)
    for (const ch of channels) expect(chip(ch.label).querySelector('svg')).not.toBeNull()
  })

  it('returns to neutral when the selection is toggled off', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(chip('Email'))
    await user.click(chip('Email'))
    expect(chip('Email')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('Email')).toHaveStyle({ background: 'var(--surface)' })
  })
})
