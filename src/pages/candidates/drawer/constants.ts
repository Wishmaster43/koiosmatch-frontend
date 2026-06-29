/**
 * Candidate drawer constants — shared styling + the one fixed real-world list.
 * (Dummy datasets live in ../data/mocks.js.)
 *
 * Controlled vocabularies are NOT here: document types, note types, statuses,
 * funnel, candidate types, functions, pools, languages, driving licences, …
 * all come from tenant lookups via their `useX()` hooks / LookupsContext.
 */
import type { CSSProperties } from 'react'
import { sectionTitle as uiSectionTitle } from '@/components/ui/SectionCard'

// Dutch provinces — a fixed real-world list, not tenant-configurable (so kept literal).
export const NL_PROVINCES: string[] = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland']

// Section card styling used across the candidate tabs (note: title carries its own
// bottom margin, unlike the shared ui/SectionCard — kept for visual parity).
export const sectionBlock: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }
// Same grey uppercase style as the shared ui/SectionCard (one visual source); the
// block-level marginBottom is added here because Planning renders it as a bare span.
export const sectionTitle: CSSProperties = { ...uiSectionTitle, display: 'block', marginBottom: 8 }
