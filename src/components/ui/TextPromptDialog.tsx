/**
 * TextPromptDialog — the house-style replacement for window.prompt() (§0 restschuld
 * cleanup). Small overlay panel: title, label, text input, Cancel + Confirm buttons.
 * Focus traps on open and returns on close. Enter submits; Escape closes. Colours are
 * tokens only (§4).
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import { formLabelStyle } from '@/components/ui/typography'
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

  // Focus the input on open, select all text so typing replaces it.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [open])

  // Handle keyboard: Enter submits, Escape cancels (via FloatingPanel's onClose).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
      header={<div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{title}</div>}
    >
      {/* Label + input in a vertical stack — the form kit's label identity and field face
          (fieldMetrics), so this dialog never paints its own input; the global
          :focus-visible rule draws the focus ring. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="text-prompt-input" style={formLabelStyle}>
          {label}
        </label>
        <input
          ref={inputRef}
          id="text-prompt-input"
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={fieldInputStyle}
        />
      </div>

      {/* Buttons: Cancel (secondary) + Confirm (primary). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {t('confirm')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
