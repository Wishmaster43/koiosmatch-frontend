// Score colour (green ≥75, amber ≥50, red below) — the ONE source (§11: the
// third hand-copy was the signal). Lives beside MatchScoreBlock in its own
// module so the component file exports only components (react-refresh rule).
export const scoreColor = (v?: number | null): string => {
  const n = v ?? 0
  return n >= 75 ? 'var(--color-success)' : n >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
}
