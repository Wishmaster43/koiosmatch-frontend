/**
 * planIntake/styles — the inline-style constants for the appointment modal's
 * chrome and fields. Split out of PlanIntakeModal.tsx so the hard-won layout
 * decisions below (the non-scrolling panel that fixed the clipped dropdown, the
 * exact "+ Kandidaat toevoegen" input footprint) live in one place with their
 * reasoning, instead of scrolling past every time the markup is read. Mirrors
 * the sibling match/styles.ts.
 */

import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'

export const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }
// S24a root-cause fix: this panel used to carry `overflowY:'auto', maxHeight:'88vh'`.
// An ancestor with a non-visible `overflow` clips ANY absolutely-positioned descendant
// (CreatableSelect/SelectMenu's dropdown) at the ancestor's own box — regardless of
// z-index — the moment the dropdown's natural height pushes past it. Since this
// modal's content is short (mirrors the unconstrained candidates/drawer/
// AddApplicationModal panel), it never genuinely needs to scroll; dropping the
// scroll container removes the clipping context instead of fighting it with z-index.
export const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }
export const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
// S24c (Danny 24-07): the exact "+ Kandidaat toevoegen" text-input footprint
// (mirrors addmodal/fields.tsx's `inputStyle`) — was `height: 36, padding: '0 10px'`,
// a taller footprint than the reference modal's inputs; padding now drives the
// height the same way TextField does, so When/Duur render at the identical size.
export const input: React.CSSProperties = { width: '100%', padding: '8px 11px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
// The exact combobox footprint (mirrors addmodal/fields.tsx's CreatableSelect wrapper).
export const fieldFootprint: React.CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }
export const errMsg: React.CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }

// P33 (13-08 decision 33-layout, batch 5): every field its own full-width
// label-left row — the canon 120px label column (fieldRowCanon), field takes
// the rest. Replaces the old two-up flex rows this modal used to render.
export const labelLeftRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }
export const rowLabel = CANON_LABEL_STYLE
export const rowField: React.CSSProperties = { flex: 1, minWidth: 0 }
