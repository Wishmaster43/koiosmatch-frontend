/**
 * ThreadComposer — WA-COMPOSER-1 (Danny's F5, 19-09: "grotere composer met
 * bold/emoji"): the WhatsApp thread's free-text input, extracted out of
 * ConversationsSection so the section itself stays a container (§3). A
 * multi-line, auto-growing textarea with a small formatting toolbar
 * (bold/italic/strikethrough via WhatsApp's own markup + a curated emoji
 * panel) and the existing Send button — Enter still sends, Shift+Enter still
 * inserts a newline, exactly like the input it replaces.
 */
import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Bold, Italic, Strikethrough, Smile, Send } from 'lucide-react'
import Button from '@/components/ui/Button'
import { bodyTextStyle } from '@/components/ui/typography'
import { wrapSelection, insertAt, useApplyFormatResult } from './useComposerFormatting'
import { COMPOSER_EMOJI } from './composerEmoji'

export interface ThreadComposerProps {
  value: string
  onChange: (text: string) => void
  onSend: () => void
  sending: boolean
  placeholder: string
}

// Auto-grow rule from the brief: rows = min(6, max(2, newline count + 1)).
function rowsFor(text: string): number {
  const lines = text.split('\n').length
  return Math.min(6, Math.max(2, lines))
}

export default function ThreadComposer({ value, onChange, onSend, sending, placeholder }: ThreadComposerProps) {
  const { t } = useTranslation('candidates')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const applyResult = useApplyFormatResult(textareaRef, onChange)

  // Toolbar formatting: wraps the current selection with the WhatsApp marker,
  // toggling it off when the selection is already wrapped (§ useComposerFormatting).
  const format = useCallback((marker: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    applyResult(wrapSelection(value, start, end, marker))
    el?.focus()
  }, [value, applyResult])

  // Inserts an emoji at the caret and keeps the panel open (per the brief),
  // returning focus to the textarea so typing can continue right after.
  const pickEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current
    const pos = el?.selectionStart ?? value.length
    applyResult(insertAt(value, pos, emoji))
    el?.focus()
  }, [value, applyResult])

  // Enter sends, Shift+Enter inserts a newline — same contract as the input it replaces.
  const onTextareaKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }, [onSend])

  // Escape closes the emoji panel regardless of which element inside the
  // composer currently has focus (the toggle button, not the textarea, right
  // after opening it) — handled on the whole composer, not just the panel.
  const onComposerKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && emojiOpen) {
      setEmojiOpen(false)
      textareaRef.current?.focus()
    }
  }, [emojiOpen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, position: 'relative' }}
      onKeyDown={onComposerKeyDown}>
      {/* Formatting toolbar: bold/italic/strikethrough (WhatsApp's own markup) + emoji toggle. */}
      <div style={{ display: 'flex', gap: 2 }}>
        <Button variant="ghost" size="sm" iconOnly aria-label={t('conversations.composer.bold')} title={t('conversations.composer.bold')}
          onClick={() => format('*')}>
          <Bold size={13} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label={t('conversations.composer.italic')} title={t('conversations.composer.italic')}
          onClick={() => format('_')}>
          <Italic size={13} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label={t('conversations.composer.strikethrough')} title={t('conversations.composer.strikethrough')}
          onClick={() => format('~')}>
          <Strikethrough size={13} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label={t('conversations.composer.emoji')} title={t('conversations.composer.emoji')}
          aria-expanded={emojiOpen} onClick={() => setEmojiOpen(o => !o)}>
          <Smile size={13} />
        </Button>
      </div>

      {/* Emoji panel: a small labelled dialog, not the heavier FloatingPanel
          (per the brief) — Escape closes it and returns focus to the textarea.
          Opens UPWARD from the toolbar (WhatsApp's own idiom) so it never
          covers the textarea/Send button/error alert below it. */}
      {emojiOpen && (
        <div role="dialog" aria-label={t('conversations.composer.emojiPanel')}
          style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, zIndex: 'var(--z-popover)', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 8, padding: 6, boxShadow: 'var(--shadow-float)', width: 220 }}>
          {COMPOSER_EMOJI.map(({ group, emoji }) => (
            <div key={group} style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
              {emoji.map(e => (
                <Button key={e} variant="ghost" size="sm" iconOnly aria-label={e} title={e}
                  onClick={() => pickEmoji(e)} style={{ width: 28, padding: 0, fontSize: 14 }}>
                  {e}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea ref={textareaRef} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onTextareaKeyDown}
          rows={rowsFor(value)} placeholder={placeholder} aria-label={placeholder}
          style={{ ...bodyTextStyle, flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4 }} />
        <Button variant="primary" onClick={onSend} disabled={!value.trim() || sending}
          aria-label={t('common:send')} title={t('common:send')} style={{ width: 30, flexShrink: 0 }}>
          <Send size={13} />
        </Button>
      </div>
    </div>
  )
}
