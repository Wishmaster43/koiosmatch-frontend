/**
 * MiniProgressBar — the 8px relative-load bar shared by the dashboard's
 * per-row tiles (RecruiterLoad, sales' ActivityByOwnerList): a muted track
 * (`--hover-bg`) and a filled bar (`--button-fill`) sized to `pct` (0-100,
 * already computed by the caller relative to that tile's own busiest row —
 * this component owns only the track/bar chrome). (DRY round 11, LAYOUT.)
 */
export default function MiniProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden', marginBottom: 5 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--button-fill)', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  )
}
