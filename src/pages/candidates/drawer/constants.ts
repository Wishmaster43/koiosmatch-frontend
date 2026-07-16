/**
 * Candidate drawer constants — shared styling + the one fixed real-world list.
 * (Planning data is now real: ../hooks/useCandidateSchedule; the dummy datasets are gone.)
 *
 * Controlled vocabularies are NOT here: document types, note types, statuses,
 * funnel, candidate types, functions, pools, languages, driving licences, …
 * all come from tenant lookups via their `useX()` hooks / LookupsContext.
 */
import type { CSSProperties } from 'react'
import { sectionTitle as uiSectionTitle } from '@/components/ui/SectionCard'
import type { Id } from '@/types/common'

// Dutch provinces — a fixed real-world list, not tenant-configurable (so kept literal).
export const NL_PROVINCES: string[] = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland']

// Section card styling used across the candidate tabs (note: title carries its own
// bottom margin, unlike the shared ui/SectionCard — kept for visual parity).
export const sectionBlock: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }
// Same grey uppercase style as the shared ui/SectionCard (one visual source); the
// block-level marginBottom is added here because Planning renders it as a bare span.
export const sectionTitle: CSSProperties = { ...uiSectionTitle, display: 'block', marginBottom: 8 }

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
