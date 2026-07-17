/**
 * matchPlacement/styles — shared inline-style constants for the placement modal
 * and its section components. Split out of MatchPlacementModal.tsx (audit R1
 * item 1, MUST-SPLIT) so every section imports the SAME tokens instead of each
 * redefining its own — one look, one place to change it.
 */

export const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }
export const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 720, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }
export const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
export const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
export const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '14px 0 8px' }
export const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
// S24c ("alle info leesbaar zonder scrollen"): a compact third column for short
// numeric cells (uren p/w, marge) so those no longer cost a whole extra row each.
export const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 14 }
export const errMsg: React.CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }

// Consistent search-box width for the relational pickers below — the widened
// panel gives each row2 column ~330px, so a slightly wider menu than the shared
// component's 220px default reads better without overflowing it.
export const pickerMenuWidth = 280
