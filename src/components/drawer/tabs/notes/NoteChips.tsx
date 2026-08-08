/**
 * NoteChips — the two soft-tint chips a note row can show: its TYPE (resolved
 * against the tenant note-type lookup) and its contact CHANNEL (resolved
 * against last-contact-types, with an icon). Pulled out of NotesTab.tsx purely
 * to keep that file under its size target (§3) — pure presentational, no state.
 */
import type { CSSProperties } from 'react'
import { CHANNEL_ICON } from './channelIcons'
import type { NoteType } from '../NotesTab'

const chipBase: CSSProperties = { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, marginRight: 6 }

// Note-type chip: resolves value→label against the given type list (chipTypes
// when the caller has one — the composer's OWN list excludes system types,
// which made the chip fall back to the raw slug, Danny 13/7).
export function NoteTypeChip({ value, types }: { value: string; types: NoteType[] }) {
  const nt = types.find(n => n.value === value || n.label === value)
  const col = nt?.color
  const soft: CSSProperties = col
    ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
    : { background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }
  return <span style={{ ...chipBase, ...soft }}>{nt?.label ?? value}</span>
}

// Channel chip — resolves value→label from the contact-channel lookup; soft tint + icon.
export function NoteChannelChip({ value, channels }: { value: string; channels: NoteType[] }) {
  const ch = channels.find(c => c.value === value || c.label === value)
  const col = ch?.color ?? 'var(--color-secondary)'
  const isHex = typeof col === 'string' && col.startsWith('#')
  const soft: CSSProperties = isHex
    ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
    : { background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)` }
  const Icon = CHANNEL_ICON[value]
  return (
    <span style={{ ...chipBase, display: 'inline-flex', alignItems: 'center', gap: 3, ...soft }}>
      {Icon && <Icon size={10} />}{ch?.label ?? value}
    </span>
  )
}
