/**
 * TextPromptDialog — the house-style replacement for window.prompt() (§0 restschuld
 * cleanup). Small overlay panel: title, label, text input, Cancel + Confirm buttons.
 * Focus traps on open and returns on close. Enter submits; Escape closes. Colours are
 * tokens only (§4).
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import { formLabelStyle, SectionTitle } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

export interface TextPromptDialogProps {
  open: boolean
  title: string
  label: string
  placeholder?: string
  value: string
  onValueChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

/**
 * TextPromptDialog — mirrors ConfirmDialog's shape but with a text input.
 * The input receives focus on open; Enter submits, Escape cancels.
 */
export default function TextPromptDialog({
  open, title, label, placeholder, value, onValueChange, onConfirm, onCancel,
}: TextPromptDialogProps) {
  const { t } = useTranslation('common')
  const inputRef = useRef<HTMLInputElement>(null)
  // Unique input id (never a hardcoded DOM id — two dialogs on one page would collide).
  const inputId = useId()
  // An empty (whitespace-only) value can never be confirmed — disables the button
  // and short-circuits Enter, instead of silently closing the dialog as if confirmed.
  const trimmedEmpty = value.trim().length === 0

  // Focus the input on open, select all text so typing replaces it.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [open])

  // Handle keyboard: Enter submits (unless the field is empty), Escape cancels (via FloatingPanel's onClose).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !trimmedEmpty) {
      onConfirm()
    }
  }

  return (
    <FloatingPanel
      open={open}
      onClose={onCancel}
      ariaLabel={title}
      width="auto"
      maxWidth="min(400px, 90vw)"
      resizable={false}
      hideClose
      bodyStyle={{
        minWidth: 300,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      header={<SectionTitle style={{ flex: 1 }}>{title}</SectionTitle>}
    >
      {/* Label + input in a vertical stack — the form kit's label identity and field face
          (fieldMetrics), so this dialog never paints its own input; the global
          :focus-visible rule draws the focus ring. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={inputId} style={formLabelStyle}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={fieldInputStyle}
        />
      </div>

      {/* Buttons: Cancel (secondary) + Confirm (primary, disabled while the field is empty). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={trimmedEmpty}>
          {t('confirm')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
