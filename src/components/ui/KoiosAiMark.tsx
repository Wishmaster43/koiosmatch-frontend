import { BrainCircuit } from 'lucide-react'

/**
 * KoiosAiMark — the Koios AI brand mark: a brain-circuit glyph in a soft rounded
 * square. Reuse it anywhere we signal "Koios AI" (sidebar, AI advisory block, the
 * table's AI markers) so the identity stays consistent.
 *
 * tone: 'soft'  = tinted background + primary glyph (calm, for content blocks);
 *       'solid' = primary background + on-accent glyph (for accent buttons).
 */
interface KoiosAiMarkProps {
  size?: number
  tone?: 'soft' | 'solid'
  title?: string
}

export default function KoiosAiMark({ size = 26, tone = 'soft', title = 'Koios AI' }: KoiosAiMarkProps) {
  const solid = tone === 'solid'
  return (
    <span role="img" aria-label={title} title={title}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: solid ? 'var(--color-primary)' : 'var(--color-primary-bg)',
        // The glyph sits ON the accent fill in 'solid' tone — use the tenant's
        // computed on-accent contrast token, not a hardcoded white (2026-08-08).
        // Soft glyph reads the READABLE accent token: raw primary on the pale tint
        // was invisible for a light brand (AENF yellow — Danny 13-08, screenshot).
        color: solid ? 'var(--color-on-accent)' : 'var(--color-primary-text)' }}>
      <BrainCircuit size={Math.round(size * 0.56)} />
    </span>
  )
}
