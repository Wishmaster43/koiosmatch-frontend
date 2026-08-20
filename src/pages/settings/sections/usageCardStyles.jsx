/**
 * Shared card/table chrome for the billing_usage sub-cards (Credits, AI usage,
 * Koios billing, WhatsApp usage) — one place so the four cards keep one look
 * (mirrors the Koios settings cards: KoiosStatusCard/KoiosPricingCard).
 */
/* eslint-disable react-refresh/only-export-components -- a style-constants module
   that also carries the tiny Tile shim its four consumers share; HMR-nicety only.
   Tile itself is the shared StatTile atom since klus c (Tile-unificatie). */
import StatTile from '@/components/ui/StatTile'
export const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
// HUISSTIJL-1: the card TITLE is the shared SectionTitle atom (13/600), not a
// local re-declaration — consumers render <SectionTitle style={{ marginBottom: 4 }}>.
export const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- th cell style OBJECT for the usage tables, not running text; the Caption/GroupLabel atoms are text components and cannot style a <th>
export const th = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--border)' }
export const td = { fontSize: 12, color: 'var(--text)', padding: '8px', borderBottom: '1px solid var(--border)' }
export const numCell = { ...td, fontFamily: 'monospace', textAlign: 'right' }
export const notice = { fontSize: 13, color: 'var(--text-muted)' }

// One metric tile — the shared StatTile atom (klus c), usage face = label-first/sm.
export function Tile({ label, value }) {
  return <StatTile label={label} value={value} size="sm" labelFirst />
}
