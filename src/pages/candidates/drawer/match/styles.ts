/**
 * match/styles — shared inline-style constants for the match modal
 * and its section components. Split out of MatchModal.tsx (audit R1
 * item 1, MUST-SPLIT) so every section imports the SAME tokens instead of each
 * redefining its own — one look, one place to change it.
 *
 * LABEL-LEFT CANON (Danny 13-08, "alles onder elkaar en niet naast elkaar"):
 * the old label-ABOVE-field rows (row2/row3/lbl below) read as one long
 * stacked strip. Mirrors PlanIntakeModal's planIntake/styles P33 canon —
 * every field is a full-width row with the label LEFT at the shared
 * CANON_LABEL_WIDTH (fieldRowCanon) and the field taking the rest; short
 * fields may still pair two label-left rows side by side via `pairRow`.
 */
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'

// eslint-disable-next-line huisstijl/no-restricted-syntax -- frozen candidate-drawer zone: local stacking inside the drawer's own context, value predates the ladder; re-rung at the planned drawer revisit, not in a sweep
export const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }
export const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
export const errMsg: React.CSSProperties = { fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }
// Kept for the rare inline label that isn't a full FormField row (e.g. the
// Contactpersoon/billing-email "label + add-button" header rows below).
export const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }

// P33 label-left row: the canon 120px label column, field takes the rest.
// No own marginBottom: the cardBox's flex gap (modalCards) already spaces rows —
// a per-row margin ON TOP doubled every gap to 24px (Danny 14-08 "spacing te veel").
export const labelLeftRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10 }
export const rowLabel = CANON_LABEL_STYLE
export const rowField: React.CSSProperties = { flex: 1, minWidth: 0 }
// Two label-left rows side by side — for short fields (CAO, dates, rates, …)
// that don't need the full row width. Each cell renders its OWN labelLeftRow.
export const pairRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

// Consistent search-box width for the relational pickers below — the panel
// gives the field column plenty of room, so a wider menu than the shared
// component's 220px default reads better without overflowing it.
export const pickerMenuWidth = 300
