import { BrainCircuit } from 'lucide-react'

/**
 * KoiosAiMark — the Koios AI brand mark: a brain-circuit glyph in a soft rounded
 * square. Reuse it anywhere we signal "Koios AI" (sidebar, AI advisory block, the
 * table's AI markers) so the identity stays consistent.
 *
 * tone: 'soft'  = tinted background + primary glyph (calm, for content blocks);
 *       'solid' = primary background + white glyph (for accent buttons).
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
        color: solid ? '#fff' : 'var(--color-primary)' }}>
      <BrainCircuit size={Math.round(size * 0.56)} />
    </span>
  )
}
