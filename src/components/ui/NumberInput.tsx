/**
 * NumberInput — the one numeric input of the house. It shows its value the way the
 * app shows every number (GETALLEN-1: thousands separators and the locale decimal, so
 * 1250 reads "1.250" in Dutch) and reads what the user types back through the
 * locale-aware parser. A native <input type="number"> cannot show a separator, which is
 * why the settings screens used to show "10000" (Danny 09-09: "as soon as it
 * becomes a thousand, I want a . in there everywhere").
 *
 * Behaviour: the field keeps the typed text while focused and re-formats on blur;
 * onChange fires with the parsed number (null when empty), clamped to min/max on blur.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatFixed, useNumberFormat } from '@/lib/formatters'
import { Caption } from '@/components/ui/typography'
import { parseLocaleNumber } from '@/lib/numberParse'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

export interface NumberInputProps {
  value: number | null | undefined
  onChange: (next: number | null) => void
  min?: number
  max?: number
  // Decimals shown at rest (0 for counts, 2 for money).
  decimals?: number
  // Field width; the digits are right-aligned like every numeric cell.
  width?: number | string
  // Text or symbol rendered before/after the field (unit, currency symbol).
  prefix?: ReactNode
  unit?: ReactNode
  disabled?: boolean
  // Fired once on blur with the final (clamped, rounded) value — for fields that persist themselves.
  onCommit?: (value: number | null) => void
  placeholder?: string
  ariaLabel?: string
  id?: string
  // Tabular figures in the mono face for money/quantity tables (§4); off by default.
  mono?: boolean
  style?: CSSProperties
}

// Clamp helper shared by blur and the initial format.
const clamp = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n))

export default function NumberInput({
  value, onChange, min, max, decimals = 0, width = 96, prefix, unit, disabled = false, onCommit,
  placeholder, ariaLabel, id, mono = false, style,
}: NumberInputProps) {
  const { t } = useTranslation('common')
  const { locale } = useNumberFormat()
  const format = (n: number | null | undefined) => (n == null ? '' : formatFixed(n, locale, decimals))
  const [text, setText] = useState(() => format(value))
  // Focus lives in a ref: the resting-text effect reads it without re-running on focus changes.
  const focusedRef = useRef(false)
  // A value the field had to clamp is SAID, never silently corrected (Danny 09-09 01:20:
  // "if I can't go above 120 months, there should be a notice about it").
  const [notice, setNotice] = useState<string | null>(null)

  // A value change from outside (load, reset) replaces the resting text; while the
  // user is typing their text wins, so a controlled re-render never eats a keystroke.
  useEffect(() => {
    if (!focusedRef.current) setText(value == null ? '' : formatFixed(value, locale, decimals))
  }, [value, decimals, locale])

  // Parse every keystroke so the form state follows the field; unreadable text is null.
  const handleChange = (next: string) => {
    setText(next)
    setNotice(null)
    onChange(parseLocaleNumber(next, locale))
  }

  // On blur: clamp, round to the allowed decimals and show the formatted value.
  const handleBlur = () => {
    focusedRef.current = false
    const parsed = parseLocaleNumber(text, locale)
    if (parsed == null) { setText(''); if (value != null) onChange(null); onCommit?.(null); return }
    const factor = 10 ** decimals
    const clamped = clamp(parsed, min, max)
    const rounded = Math.round(clamped * factor) / factor
    if (max != null && parsed > max) setNotice(t('field.maxNotice', { max: format(max) }))
    else if (min != null && parsed < min) setNotice(t('field.minNotice', { min: format(min) }))
    else setNotice(null)
    if (rounded !== value) onChange(rounded)
    setText(format(rounded))
    onCommit?.(rounded)
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {prefix != null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prefix}</span>}
      <input
        id={id} type="text" inputMode="decimal" value={text} disabled={disabled} placeholder={placeholder}
        aria-label={ariaLabel} aria-invalid={notice ? true : undefined}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { focusedRef.current = true }}
        onBlur={handleBlur}
        style={{ ...fieldInputStyle, width, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          ...(mono ? { fontFamily: 'var(--font-mono)' } : {}), ...style }}
      />
      {unit != null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span>}
    </span>
    {notice && <span role="status"><Caption style={{ color: 'var(--color-warning-text)' }}>{notice}</Caption></span>}
    </span>
  )
}
