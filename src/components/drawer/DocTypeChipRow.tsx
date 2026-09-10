import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { LookupOption } from '@/types/common'

// Hoisted: an inline accent literal under background: false-fires the accent-fill selector.
const ACCENT = 'var(--color-primary)'

interface DocTypeChipRowProps {
  options: LookupOption[]
  isActive: (value: string) => boolean
  onPick: (value: string) => void
}

/** Shared "pick a document type" chip row (candidate upload queue's "apply to
 * all" chips, the vacancy staged-file card's single-type chips) — DOM-identical
 * at both call sites, "active" is resolved by the caller: a single staged file
 * compares its own type, a multi-file queue checks every item already shares one.
 */
export default function DocTypeChipRow({ options, isActive, onPick }: DocTypeChipRowProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
      {/* Choice-chips (CHIP-TINT-1): the lib/tint house pair + chipInk — was a
          hand-rolled 14/45 pair with RAW accent ink. Block form: the style
          attr spans the tag. */}
      {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
      {options.map(opt => {
        const active = isActive(opt.value)
        return (
          <button key={opt.value} onClick={() => onPick(opt.value)}
            style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: active ? 600 : 400,
              border: active ? tintBorder(ACCENT, true) : '1px solid var(--border)',
              background: active ? tintBg(ACCENT, true) : 'var(--surface)',
              color: active ? chipInk(ACCENT) : 'var(--text)' }}>{opt.label}</button>
        )
      })}
      {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
    </div>
  )
}
