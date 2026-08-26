/**
 * AiAgentAvatar — a round bubble in the house button trio carrying the lucide
 * Sparkle mark, next to the linked AI agent's name. Mirrors Avatar's soft variant
 * (same round shape, §4) but marks "this is a Koios AI agent"
 * instead of a person's initials — so the vacancy table's AI-agent column reads as
 * an agent, not a plain name (Danny 22-07). One accent, not per-item: every agent
 * IS Koios AI, so the tint is always the fixed `--color-primary` token (documented
 * exception to Avatar's per-item hashed colour — there is nothing to vary here).
 * The sparkle icon is decorative (aria-hidden, both on the bubble and explicitly on
 * the icon itself so it never depends on lucide's implicit default); `aria-label`
 * sits on the outer wrapper — not the hidden bubble — so assistive tech still gets
 * exactly one accessible name for the whole unit even though the name is also
 * visible text.
 */
import { Sparkle } from 'lucide-react'

// Renders the Koios agent bubble + name; nothing shown
// without a name (an unlinked record gets no placeholder bubble).
export default function AiAgentAvatar({ name, size = 22 }: { name?: string; size?: number }) {
  if (!name) return null
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={name} aria-label={name}>
      <span aria-hidden="true"
        style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          // HUISSTIJL-1: the accent-tinted avatar bubble reads the house trio, solid.
          background: 'var(--button-fill)',
          border: '1px solid var(--button-border)',
          color: 'var(--button-ink)' }}>
        <Sparkle size={Math.round(size * 0.55)} aria-hidden="true" />
      </span>
      <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  )
}
