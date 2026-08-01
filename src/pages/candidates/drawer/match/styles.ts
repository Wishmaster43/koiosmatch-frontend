/**
 * match/styles — shared inline-style constants for the match modal
 * and its section components. Split out of MatchModal.tsx (audit R1
 * item 1, MUST-SPLIT) so every section imports the SAME tokens instead of each
 * redefining its own — one look, one place to change it.
 */
import { WIDE_MODAL } from '@/components/ui/modalMetrics'

export const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }
// Standardized frame (Danny 24-07 point 6): same maxWidth/maxHeight as +Kandidaat
// (src/components/ui/modalMetrics.ts) — width itself stays a vw value (rather than
// AddCandidateModal's width:'100%') because this panel is `position: fixed` with
// no padded flex-center overlay of its own; `94vw` is what gives it the same
// off-the-edge breathing room on narrow viewports.
export const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: '94vw', maxWidth: WIDE_MODAL.maxWidth, maxHeight: WIDE_MODAL.maxHeight, overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' }
// Field label — mirrors addmodal/fields' Field label (11px uppercase muted) so the
// two "wide form" modals read as one system (Danny 24-07 point 3 card idiom).
export const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }
export const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
export const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
// S24c ("alle info leesbaar zonder scrollen"): a compact third column for short
// numeric cells (uren p/w, marge) so those no longer cost a whole extra row each.
export const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 14 }
// Three EVEN columns (job 7.4: the Vestiging picker joins Functie/Eigenaar) —
// distinct from row3, whose third slot is a narrow fixed width for short numeric cells.
export const row3Even: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }
export const errMsg: React.CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }

// Section-level two-column layout (punt C.2.1): Contract + Financieel sit SIDE BY
// SIDE under the full-width Relaties block instead of stacking three sections
// top-to-bottom — Danny's "lange smalle strook" complaint. Relaties keeps the
// full panel width for its long-list searchable pickers; Contract/Financieel are
// shorter, plain-input-heavy sections that pair up fine in half the width.
// Financieel (right) gets the wider share (Danny 24-07: "financieel moet groter") —
// its three-across rate row + billing block need the room; Contract/Opmerkingen don't.
export const twoColSections: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 24, alignItems: 'start' }

// Consistent search-box width for the relational pickers below — the wide panel
// gives the full-width Relaties row2 columns plenty of room, so a wider menu
// than the shared component's 220px default reads better without overflowing it.
export const pickerMenuWidth = 340
