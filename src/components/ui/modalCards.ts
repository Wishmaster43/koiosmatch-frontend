/**
 * modalCards — the shared "titled bordered card" chrome for the app's wide
 * create-modals (+ Kandidaat, + Match, + Klant, + Vestiging, + Afdeling,
 * + Contactpersoon, + Kans, + Vacature, + Taak, + Bellijst, + Dienst, …).
 * Danny 27-07 audit: every one of these copied the same cardHead/cardBox/row2/
 * row3Even object literals verbatim instead of sharing them, each with a
 * "kept local, CLAUDE.md §2 forbids cross-entity imports" comment — that rule
 * is about one ENTITY PAGE reaching into another entity's internals, not about
 * sharing chrome via `components/ui` (§2 explicitly names that as the shared
 * home). One module now backs every copy (CLAUDE.md §11). Mirrors
 * modalMetrics.ts's WIDE_MODAL — same idea, same file style.
 */
import type { CSSProperties } from 'react'

// Card heading — 11px uppercase muted label above a bordered surface (§3A card idiom).
export const cardHead = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
// Card surface — bordered, tinted panel; a flex column so its own fields/rows
// space out purely via `gap` (no per-field margin needed inside a card).
export const cardBox = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex' as const, flexDirection: 'column' as const, gap: 12 }

// One grid-row builder for whatever column ratio a specific row needs inside a
// card (e.g. the address block's street '2fr 1fr 1fr' / postcode '1fr 2fr').
export const row = (cols: string): CSSProperties => ({ display: 'grid', gridTemplateColumns: cols, gap: 12 })
// The two presets nearly every card reaches for: two even fields, three even fields.
export const row2 = row('1fr 1fr')
export const row3Even = row('1fr 1fr 1fr')

// Two CARDS side by side (distinct from row2/row3Even, which pair FIELDS inside
// ONE card) — the wide frame's two-column section layout (e.g. Vestiging +
// Eigenaar&status, Algemeen + Bron, Algemeen + Waarde&fase).
export const cardPair = { display: 'grid' as const, gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' as const }
