/**
 * TitleBadge — the ONE read-only, colour-coded pill shown beside an entity's
 * drawer title (candidate phase, opportunity stage, application phase, task
 * status, outreach status, …). Extracted so every drawer's title badge stays
 * pixel-identical (§3A) instead of re-copying the inline style a fourth time.
 * Uses color-mix (not hex-concat) so it also works with CSS-var tokens, not
 * just hex lookup colours (mirrors the shared SoftChip convention, §4).
 */
interface TitleBadgeProps {
  label?: string | null
  color?: string | null
}

export default function TitleBadge({ label, color }: TitleBadgeProps) {
  if (!label) return null
  // Neutral grey fallback when the lookup carries no colour yet (mirrors the same
  // constant used across the app, e.g. CandidateDrawer's avatarColor default).
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
  const c = color || '#9CA3AF'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
      background: `color-mix(in srgb, ${c} 10%, transparent)`, color: c,
      border: `1px solid color-mix(in srgb, ${c} 33%, transparent)`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
