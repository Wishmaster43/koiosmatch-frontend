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
        background: 'white', border: '1px solid #F3F4F6', borderRadius: 12,
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        cursor: onClick ? 'pointer' : undefined, transition: 'background 0.1s',
      }}
      onClick={onClick}
      onMouseEnter={onClick ? e => (e.currentTarget.style.background = '#F9FAFB') : undefined}
      onMouseLeave={onClick ? e => (e.currentTarget.style.background = 'white') : undefined}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {loading ? <span style={{ color: '#E5E7EB' }}>—</span> : value}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{label}</div>
        {sub && !loading && (
          <div style={{ fontSize: 11, color, fontWeight: 500, marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}
