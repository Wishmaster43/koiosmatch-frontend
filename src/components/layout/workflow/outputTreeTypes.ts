/**
 * outputTreeTypes — pure classifiers for the Make-style typed field tree
 * (glyph + "empty" detection + bundle-array test + field count). No React, no
 * i18n: OutputTree and its glyph/bundle sub-components build on these.
 */

// The Make-style type bucket a value falls into for its row glyph.
export type OutputValueType = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'empty'

// Classifies a value into one of the typed-tree buckets; null/''/[]/{} are all "empty".
export function classifyValue(v: unknown): OutputValueType {
  if (v == null || v === '') return 'empty'
  if (Array.isArray(v)) return v.length === 0 ? 'empty' : 'array'
  if (typeof v === 'object') return Object.keys(v as object).length === 0 ? 'empty' : 'object'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  return 'text'
}

// The Make glyph for a classified type — boolean needs the raw value for ✓ vs ✗.
export function glyphFor(type: OutputValueType, value?: unknown): string {
  switch (type) {
    case 'number': return '#'
    case 'boolean': return value ? '✓' : '✗'
    case 'object': return '{ }'
    case 'array': return '[ ]'
    case 'empty': return '∅'
    default: return 'T'
  }
}

// True when an array's items are all plain objects — Make renders these as numbered Bundle rows.
export function isBundleArray(v: unknown): boolean {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.every(item => item != null && typeof item === 'object' && !Array.isArray(item))
}

// Own enumerable key count of a plain object; 0 for arrays/primitives/nullish.
export function fieldCount(obj: unknown): number {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return 0
  return Object.keys(obj as object).length
}
