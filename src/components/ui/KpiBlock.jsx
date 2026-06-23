/**
 * KpiBlock — small KPI card (icon tile + value + label + optional sub-text).
 *
 * Shared by the Customers/Locations/Departments reports.
 * When onClick is provided the card becomes clickable (hover highlight + pointer cursor).
 * Shows an em-dash while `loading`.
 */
export default function KpiBlock({ label, value, sub, icon: Icon, color, bg, loading, onClick }) {
  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        cursor: onClick ? 'pointer' : undefined, transition: 'background 0.1s',
      }}
      onClick={onClick}
      onMouseEnter={onClick ? e => (e.currentTarget.style.background = 'var(--hover-bg)') : undefined}
      onMouseLeave={onClick ? e => (e.currentTarget.style.background = 'var(--surface)') : undefined}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {loading ? <span style={{ color: 'var(--border)' }}>—</span> : value}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
        {sub && !loading && (
          <div style={{ fontSize: 11, color, fontWeight: 500, marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}
