import type { CSSProperties } from 'react'

/**
 * Shared column geometry for a match summary row that sits UNDER a header bar —
 * the ONE source both the header cells (candidates/drawer/MatchesTab.tsx) and the
 * row cells (MatchCard.tsx) read, mirroring candidates/drawer/applicationRowColumns.ts.
 *
 * Why it exists (Danny 09-08): the header declared `width: 140` while the row cell
 * used `maxWidth: 140`, so the cell shrank to its content and slid left the moment
 * the client name was short — the "Klant" label then pointed at empty space. A
 * header only means something if the cell below it occupies the same column.
 *
 * SECOND LOOK (Danny 09-08, "Open heeft geen kopje??"): the header only ever
 * declared Vacature/Klant/actions, while the row rendered FOUR things — vacancy
 * title, a status pill glued onto the title behind an em-dash, the client name,
 * and a score pill sitting as an unlabeled dash before the icon cluster. Status
 * and Match(score) are now real columns with their own header, reading their
 * widths from here — the header component itself was ALSO still hardcoding its
 * own `width: 140` literals instead of importing MATCH_COL_OTHER_PARTY /
 * MATCH_COL_ACTIONS, the exact "two loose numbers" bug this file exists to
 * prevent; both header and row now read every column from here.
 *
 * These apply to the flat, header-barred list — since KLANTEN 4 (21-08) that is
 * ALL three drawer Matches tabs (candidate, customer, vacancy), each rendering
 * the shared MatchListHeaderBar above `flatRow` cards.
 */

// Shared base width for the other-party column, kept as its own constant because
// the non-flat variant still uses it as a maxWidth ceiling.
export const MATCH_COLUMN_WIDTH = 140

// Status pill column (STATUS-COLUMN-1, Danny 09-08 second look) — the stage used
// to be glued onto the title behind an em-dash with no column of its own at all.
// Same width as the candidate drawer's own application-status column
// (applicationRowColumns.ts:APPLICATION_COL_STATUS): match-status labels are the
// same tenant-lookup class of short phrase (seed "Actief"/"Afgesloten", but a
// tenant can rename them as long as a funnel stage), so the same conservative
// width applies.
export const MATCH_COL_STATUS: CSSProperties = { width: 108, flexShrink: 0 }

// Other party (client on the candidate side) — a real fixed column.
// SHRINKABLE on purpose (Danny 09-08: "vacature naam niet te lezen"). The
// vacancy title is what identifies the row; a client name is context. When the
// drawer gets narrow SOMETHING has to give, and it should be the context, not the
// identity. flex-basis 128 with shrink allowed, floored at 72 so it never becomes
// a stub. Header and row read this SAME constant, so they shrink in step.
export const MATCH_COL_OTHER_PARTY: CSSProperties = { flex: '0 1 128px', minWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// Score column (SCORE-COLUMN-1, Danny 09-08 second look, point 3): the score pill
// is a DATA value ("82%" or a muted dash when unscored) that the user READS, not
// a click action — it gets its own labeled column ("Match", reusing
// matches:cols.score — the exact header MatchesTable already uses for this same
// value) instead of sitting as an unlabeled dash between the client name and the
// icon cluster, which was the SECOND headerless column Danny flagged. Right-
// aligned, sized to comfortably fit "100%" and the 5-letter header.
export const MATCH_COL_SCORE: CSSProperties = { width: 56, flexShrink: 0, textAlign: 'right' }

// Trailing cluster: open-in-new + edit pencil + backoffice-linked glyph +
// vacancy-URL link + the disclosure chevron. PURE click-actions only (nothing
// here is a value the user reads — that is now the Score column above), mirroring
// ApplicationRow's own actions column, so it keeps the shared EMPTY header. The
// chevron now renders INSIDE this column for the flatRow variant (MatchCard.tsx)
// — it used to sit outside every column entirely, so the row ran wider than the
// header's own trailing cell. Width unchanged from before the Score-column split:
// 140 already comfortably covered the icon set on its own (a wide action rail was
// never the bug Danny flagged), so it is not re-measured down.
// Sized to what actually renders: open-in-new (24) + pencil (24) + chevron (22)
// with two 8px gaps = 86. It sat at 140 — 54px of dead space that the vacancy
// title paid for, which is why that title collapsed to "A..." in a drawer
// (Danny 09-08). A column reserves what it needs, not a round number.
export const MATCH_COL_ACTIONS: CSSProperties = { width: 96, flexShrink: 0 }
