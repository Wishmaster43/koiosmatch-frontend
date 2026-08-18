/**
 * SortCaret — the ONE sort indicator (HUISSTIJL-1, Danny 18-08: "sort knopje
 * soms wel soms niet gekleurd"). Measured before this existed: DataTable's
 * active caret inherited the header text colour (read as grey) while the
 * Shiftmanager report tables coloured theirs --color-primary-text — two recipes
 * for the same signal. One recipe now: active = the readable accent twin,
 * inactive = the muted double-chevron at reduced opacity so the header text
 * keeps the focus. aria-hidden throughout: the sort STATE is announced by the
 * header button's aria-sort/labels, never by the picture.
 */
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export default function SortCaret({ active, dir, size = 12 }: {
  active: boolean
  dir?: 'asc' | 'desc'
  size?: number
}) {
  if (!active) return <ChevronsUpDown size={size} aria-hidden="true" style={{ opacity: 0.35 }} />
  return dir === 'asc'
    ? <ChevronUp size={size} aria-hidden="true" style={{ color: 'var(--color-primary-text)' }} />
    : <ChevronDown size={size} aria-hidden="true" style={{ color: 'var(--color-primary-text)' }} />
}
