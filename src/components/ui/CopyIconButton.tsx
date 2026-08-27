/**
 * CopyIconButton — the ONE inline click-to-copy affordance for any displayed
 * value (address lines, reference numbers, …): copies to the clipboard, flashes
 * a Check icon, and fires the shared success toast. Generalises the copy idiom
 * that used to live only inside ReferenceNumberChip (§11 adoption). `children`
 * render INSIDE the button, so a composing chip keeps its FULL click area.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { notifySuccess } from '@/lib/notify'

interface CopyIconButtonProps {
  // The text to place on the clipboard; nothing renders without one.
  value?: string | null
  // Accessible name + tooltip; MUST name what is copied ("Kopieer adres", …).
  label: string
  // Toast text after a successful copy ("Adres gekopieerd", …).
  copiedLabel: string
  // Optional content rendered inside the button BEFORE the icon (full hit area).
  children?: ReactNode
  // Icon size (the chip keeps its historical 10px; standalone default 11).
  iconSize?: number
  // Layout-only styling on the button (font family for the chip, …).
  style?: CSSProperties
}

// Muted, borderless, inline-flex copy control; renders nothing without a value.
export default function CopyIconButton({ value, label, copiedLabel, children, iconSize = 11, style }: CopyIconButtonProps) {
  useTranslation('common') // keeps the component inside the i18n render cycle for language switches
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Clear the flash timer on unmount so a fast-closing drawer never sets state late.
  useEffect(() => () => clearTimeout(timerRef.current), [])
  if (!value) return null

  // Copy to the clipboard + a small success toast; the icon briefly confirms too.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      notifySuccess(copiedLabel)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard API unavailable (older browser/permissions) — no-op */ }
  }

  // The rule reports on the style-carrying line, so the tag stays single-line
  // with the necessity disable directly above it (§14 r7: an inline copy
  // affordance rides INSIDE a text line; Button sm's fixed 28px footprint
  // breaks the row height — mirrors the chip this atom generalises).
  const face: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none',
    border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'var(--text-muted)', ...style }
  return (
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see the necessity comment above
    <button type="button" onClick={copy} title={label} aria-label={label} style={face}>
      {children}
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} style={{ opacity: 0.6 }} />}
    </button>
  )
}
