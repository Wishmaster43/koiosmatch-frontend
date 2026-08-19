import { BrainCircuit } from 'lucide-react'

/**
 * KoiosAiMark — the Koios AI brand mark: a brain-circuit glyph in a soft rounded
 * square. Reuse it anywhere we signal "Koios AI" (sidebar, AI advisory block, the
 * table's AI markers) so the identity stays consistent.
 *
 * tone: 'soft'  = the house trio's tint (--button-fill/--button-ink), so the mark
 *                  follows the tenant's chosen fill instantly (calm, for content blocks);
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
        // HUISSTIJL-1: 'soft' now reads the same trio every accent action button
        // reads (--button-fill/--button-ink), so the mark tracks the tenant's fill
        // the instant it changes — no separate tint token to keep in sync.
        background: solid ? 'var(--color-primary)' : 'var(--color-primary-bg)',
        // The glyph sits ON the accent fill in 'solid' tone — use the tenant's
        // computed on-accent contrast token, not a hardcoded white (2026-08-08).
        color: solid ? 'var(--color-on-accent)' : 'var(--color-primary-text)' }}>
      <BrainCircuit size={Math.round(size * 0.56)} />
    </span>
  )
}
