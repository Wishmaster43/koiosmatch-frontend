/**
 * OutputTreeGlyph — the fixed-width typed-value glyph (T/#/✓/✗/{ }/[ ]/∅) that
 * prefixes a row when OutputTree's `typed` option is on. Presentational only,
 * so rows stay aligned regardless of glyph width.
 */
import { Caption, monoStyle } from '@/components/ui/typography'
import { classifyValue, glyphFor, type OutputValueType } from './outputTreeTypes'

// Renders the glyph for a value, or for an already-known type (branch rows know their type up front).
export default function OutputTreeGlyph({ value, type }: { value?: unknown; type?: OutputValueType }) {
  const resolved = type ?? classifyValue(value)
  return (
    <Caption style={{ ...monoStyle, flexShrink: 0, width: 18, textAlign: 'center' }}>
      {glyphFor(resolved, value)}
    </Caption>
  )
}
