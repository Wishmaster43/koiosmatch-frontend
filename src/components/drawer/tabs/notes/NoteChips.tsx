/**
 * NoteChips — the two soft-tint chips a note row can show: its TYPE (resolved
 * against the tenant note-type lookup) and its contact CHANNEL (resolved
 * against last-contact-types, with an icon). Pulled out of NotesTab.tsx purely
 * to keep that file under its size target (§3) — pure presentational, no state.
 */
import { CHANNEL_ICON } from './channelIcons'
import type { NoteType } from '../NotesTab'
import SoftChip from '@/components/ui/SoftChip'

// Note-type chip: resolves value→label against the given type list (chipTypes
// when the caller has one — the composer's OWN list excludes system types,
// which made the chip fall back to the raw slug, Danny 13/7). SoftChip — the
// ONE chip component (§4, HUISSTIJL-1) — replaces the old hex-concat tint;
// the fallback stays the primary accent (never SoftChip's own neutral grey),
// so a note type without a tenant colour still reads as "on brand".
export function NoteTypeChip({ value, types }: { value: string; types: NoteType[] }) {
  const nt = types.find(n => n.value === value || n.label === value)
  return (
    <span style={{ marginRight: 6 }}>
      <SoftChip label={nt?.label ?? value} color={nt?.color ?? 'var(--color-primary)'} round size={10} />
    </span>
  )
}

// Channel chip — resolves value→label from the contact-channel lookup; soft tint + icon.
// SoftChip's tintBg/tintBorder already work for both hex and var() tokens via
// color-mix, so the old isHex ternary (a third, redundant recipe) is gone.
export function NoteChannelChip({ value, channels }: { value: string; channels: NoteType[] }) {
  const ch = channels.find(c => c.value === value || c.label === value)
  const col = ch?.color ?? 'var(--color-secondary)'
  const Icon = CHANNEL_ICON[value]
  return (
    <span style={{ marginRight: 6 }}>
      <SoftChip color={col} round size={10} label={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {Icon && <Icon size={10} />}{ch?.label ?? value}
        </span>
      } />
    </span>
  )
}
