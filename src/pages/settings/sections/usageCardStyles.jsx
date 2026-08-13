/**
 * Shared card/table chrome for the billing_usage sub-cards (Credits, AI usage,
 * Koios billing, WhatsApp usage) — one place so the four cards keep one look
 * (mirrors the Koios settings cards: KoiosStatusCard/KoiosPricingCard).
 */
export const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
export const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }
export const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }
export const th = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--border)' }
export const td = { fontSize: 12, color: 'var(--text)', padding: '8px', borderBottom: '1px solid var(--border)' }
export const numCell = { ...td, fontFamily: 'monospace', textAlign: 'right' }
export const notice = { fontSize: 13, color: 'var(--text-muted)' }

// One metric tile (label above a bold value) — mirrors TenantUsageSettings' Tile.
export function Tile({ label, value }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 120, background: 'var(--hover-bg)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  )
}
