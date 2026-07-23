import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { strings } from '../strings'

interface RichTextAreaProps {
  id: string
  label: string
  value: string
  onChange: (html: string) => void
  // Settings-driven required marker (CAREERSITE-APPLY-2) — shows a visual asterisk
  // (CSS-only, so the accessible name computed from `label` never changes) and
  // sets aria-required on the editor itself.
  required?: boolean
}

// One toolbar command: the execCommand name paired with its i18n aria-label/tooltip.
// The glyph is decorative (aria-hidden) — the button's own aria-label carries the meaning.
interface ToolbarCommand {
  command: 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList'
  glyph: string
  title: string
}

const COMMANDS: ToolbarCommand[] = [
  { command: 'bold', glyph: 'B', title: strings.apply.richText.bold },
  { command: 'italic', glyph: 'I', title: strings.apply.richText.italic },
  { command: 'insertUnorderedList', glyph: '•', title: strings.apply.richText.bulletList },
  { command: 'insertOrderedList', glyph: '1.', title: strings.apply.richText.numberedList },
]

// Dependency-free rich-text block: contentEditable + document.execCommand (Danny 23-07 —
// the careersite stays dependency-light and the admin app's editor is unreachable across
// the app boundary). execCommand is deprecated but still universally supported by browsers
// for exactly this basic bold/italic/list use case; every call is feature-detected so a
// future browser without it degrades to a harmless no-op instead of a crash.
export function RichTextArea({ id, label, value, onChange, required = false }: RichTextAreaProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [activeCommands, setActiveCommands] = useState<Record<string, boolean>>({})
  const labelId = `${id}-label`

  // Uncontrolled by design: the DOM is the source of truth while typing. Only syncs
  // innerHTML in when `value` changes from OUTSIDE (e.g. a form reset), never on every
  // keystroke — that would fight the live selection and jump the cursor.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  // Reads which commands apply at the current selection, so toolbar buttons reflect
  // real editor state via aria-pressed rather than a locally-guessed "was clicked" flag.
  const refreshActiveState = () => {
    if (typeof document.queryCommandState !== 'function') return
    const next: Record<string, boolean> = {}
    for (const { command } of COMMANDS) next[command] = document.queryCommandState(command)
    setActiveCommands(next)
  }

  // Runs one formatting command on the current selection and reports the resulting HTML.
  const runCommand = (command: string) => {
    if (typeof document.execCommand !== 'function') return
    document.execCommand(command)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
    refreshActiveState()
  }

  // contentEditable's native input event is the single source of truth for the HTML value.
  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    onChange(event.currentTarget.innerHTML)
  }

  // Explicit Cmd/Ctrl+B and Cmd/Ctrl+I so the toolbar commands stay fully keyboard-operable
  // (CLAUDE.md §6) and behave identically across browsers rather than relying on each
  // browser's own default contentEditable shortcut handling.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.metaKey && !event.ctrlKey) return
    const key = event.key.toLowerCase()
    if (key === 'b') {
      event.preventDefault()
      runCommand('bold')
    } else if (key === 'i') {
      event.preventDefault()
      runCommand('italic')
    }
  }

  return (
    <div className="apply-form__field rich-text">
      <span
        id={labelId}
        className={required ? 'rich-text__label required-marker' : 'rich-text__label'}
        onClick={() => editorRef.current?.focus()}
      >
        {label}
      </span>
      <div className="rich-text__toolbar" role="toolbar" aria-label={label}>
        {COMMANDS.map(({ command, glyph, title }) => (
          <button
            key={command}
            type="button"
            className="rich-text__tool"
            aria-label={title}
            aria-pressed={activeCommands[command] ?? false}
            title={title}
            // Keeps the current text selection alive: a real button click always steals
            // focus first, which would otherwise collapse the contentEditable selection.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command)}
          >
            <span aria-hidden="true">{glyph}</span>
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        id={id}
        className="rich-text__editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        aria-required={required || undefined}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshActiveState}
        onMouseUp={refreshActiveState}
        onFocus={refreshActiveState}
      />
    </div>
  )
}
