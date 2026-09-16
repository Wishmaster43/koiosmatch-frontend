/**
 * Candidate drawer constants — shared styling + the one fixed real-world list.
 * (Planning data is now real: ../hooks/useCandidateSchedule; the dummy datasets are gone.)
 *
 * Controlled vocabularies are NOT here: document types, note types, statuses,
 * funnel, candidate types, functions, pools, languages, driving licences, …
 * all come from tenant lookups via their `useX()` hooks / LookupsContext.
 */
import type { CSSProperties } from 'react'
import { groupLabelStyle } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { Id } from '@/types/common'

// Dutch provinces — a fixed real-world list, not tenant-configurable (so kept literal).
export const NL_PROVINCES: string[] = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland']

// Section card styling used across the candidate tabs (note: title carries its own
// bottom margin, unlike the shared ui/SectionCard — kept for visual parity).
export const sectionBlock: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }
// Same grey uppercase style as the shared GroupLabel atom (one visual source,
// letterSpacing kept at 0.04em to match the pre-existing candidate-tab render);
// the block-level marginBottom is added here because Planning renders it as a bare span.
export const sectionTitle: CSSProperties = { ...groupLabelStyle, letterSpacing: '0.04em', display: 'block', marginBottom: 8 }

// Soft-tint selectable pill (CHIP-TINT-1, Danny 20-08: a selected CHOICE chip —
// day/shift-type/planning filters — wears the active 16/50 tint, never a solid
// fill; the button trio is reserved for actual buttons/toolbars). Built on the
// shared lib/tint recipe so it never drifts into its own percentage.
export const softPill = (active: boolean, color: string = 'var(--color-primary)'): CSSProperties => ({
  color: active ? chipInk(color) : 'var(--text-muted)',
  fontWeight: active ? 600 : 400,
  background: active ? tintBg(color, true) : 'transparent',
  border: active ? tintBorder(color, true) : '1px solid var(--border)',
})

// Real emptiness for a mapped candidate field — mapCandidate.ts writes '-' (and
// archiveGuard.ts writes '—') as the display placeholder for a missing
// mobile/address, both truthy and would silently defeat a `!field`
// disabled-gate (D8 no-fake-affordance). Single source: adopted by
// candidateAiInsights.ts's completeness check instead of a second copy
// (CLONE-BY-CONSTRUCTION-1).
export const hasValue = (v: unknown): boolean => Boolean(v) && v !== '-' && v !== '—'

// Return-tab memory (NAV-BACK-1 tab-remember): candidate→Match cross-navigation
// (MatchesTab's "open match" icon) stashes which drawer subtab was active so
// browser BACK reopens the SAME subtab instead of resetting to Profile. In-memory
// only (a plain module-scope Map, not sessionStorage) — it only needs to survive
// one unmount/remount round-trip within this SPA session, never a full reload, and
// carries no user data worth persisting past that. Peek is non-destructive (read
// during render, safe under StrictMode's double-invoke); clear is destructive and
// must only run from an effect (consume-once, so a later unrelated re-open of the
// same candidate defaults back to Profile).
const returnTabMemory = new Map<string, string>()
export const rememberReturnTab = (id: Id, tab: string) => { returnTabMemory.set(String(id), tab) }
export const peekReturnTab = (id: Id): string | null => returnTabMemory.get(String(id)) ?? null
export const clearReturnTab = (id: Id) => { returnTabMemory.delete(String(id)) }
