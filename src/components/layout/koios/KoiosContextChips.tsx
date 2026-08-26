/**
 * KoiosContextChips — the removable pill row above the composer: manual
 * @-mentions plus the two AMBIENT chips (open drawer + table selection,
 * KOIOS-SELECTIE-CONTEXT-1). Split out of KoiosPanel (§0.3 size discipline) —
 * purely presentational, all merge/dedupe/dismiss logic lives in the panel and
 * useKoiosContextChips. A type the backend can't resolve yet (koiosContextTypes)
 * still renders as a chip (the pin stays visible) but dashed + tooltipped — it
 * is pinned client-side ONLY and never sent in the outgoing context[] (unchanged
 * KOIOS-CTX-1 convention). The remove control is the real Button (iconOnly,
 * ghost) shrunk via its own `style` escape hatch (§3: layout via style, identity
 * never) — small enough to nest inside the pill without a second chrome face.
 */
import { X } from 'lucide-react'
import { tint, tintBg, TINT_BORDER } from '@/lib/tint'
import { isContextResolvable } from './koiosContextTypes'
import type { KoiosContextRef, TFn } from '@/types/koios'

export interface KoiosContextChipRow {
  ref: KoiosContextRef
  onRemove: () => void
}

// A named constant (not the literal inline) so tintBg/tintBorder's ARGUMENT
// never reads as a hand-painted `background: var(--color-primary)` fill.
const ACCENT = 'var(--color-primary)'

// Purely presentational chip row (see file docblock above); renders nothing with
// no chips, and dashes/tooltips any chip type the backend can't resolve yet.
export default function KoiosContextChips({ chips, t }: { chips: KoiosContextChipRow[]; t: TFn }) {
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {chips.map(({ ref, onRemove }) => {
        const pending = !isContextResolvable(ref.type)
        return (
          <span key={ref.id} title={pending ? t('koios.contextPending') : undefined} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999,
            fontSize: 11, fontWeight: 500,
            // §4 tint formula via lib/tint, not an ad-hoc color-mix percentage.
            background: tintBg(ACCENT),
            color: 'var(--color-primary-text)',
            border: `1px ${pending ? 'dashed' : 'solid'} ${tint(ACCENT, TINT_BORDER)}`,
          }}>
            {ref.label}
            {/* Chip-remove sized by its icon (no explicit height: the maatwet ratchet
                forbids off-standard button heights) — a dense inline control INSIDE
                the chip where Button's fixed sm footprint cannot sit. */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- dense chip-remove inside a context chip; Button's fixed sm footprint cannot sit in the chip (§14 r7 necessity, mirrors MultiSelectField's chip-remove) */}
            <button type="button" onClick={onRemove} aria-label={`${t('remove')} ${ref.label}`}
              style={{ display: 'inline-flex', alignItems: 'center', padding: 0, lineHeight: 0,
                background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              <X size={10} />
            </button>
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          </span>
        )
      })}
    </div>
  )
}
