/**
 * TitleEditInput — shared inline text input for title editing in drawer headers.
 * Enter saves; the value is controlled by the host.
 */
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { pageTitleStyle } from '@/components/ui/typography'

interface TitleEditInputProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  ariaLabel?: string
}

// Inline input for title editing; saves on Enter key.
// D6: `ariaLabel` is optional for callers with a more specific name, but the
// input always has a real accessible name — a generic i18n fallback covers
// the caller that omits it, instead of shipping a nameless control.
export default function TitleEditInput({ value, onChange, onSave, ariaLabel }: TitleEditInputProps) {
  const { t } = useTranslation('common')
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSave()
    }
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel ?? t('titleField')}
      style={{
        ...pageTitleStyle,
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        outline: 'none',
      }}
    />
  )
}
