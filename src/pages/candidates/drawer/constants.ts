/**
 * Candidate drawer constants — config lists shared by the candidate tabs.
 * (Dummy datasets live in ../data/mocks.js.)
 */
import type { CSSProperties } from 'react'

// Stored value (stable for the backend + colour map) + i18n key for the label.
export const DOC_TYPES: Array<{ value: string; key: string }> = [
  { value: 'CV',          key: 'cv' },
  { value: 'ID-bewijs',   key: 'id' },
  { value: 'Diploma',     key: 'diploma' },
  { value: 'Contract',    key: 'contract' },
  { value: 'VOG',         key: 'vog' },
  { value: 'Certificaat', key: 'certificate' },
  { value: 'Overig',      key: 'other' },
]

export const DOC_COLORS: Record<string, string> = {
  'CV':         'var(--color-secondary)',
  'ID-bewijs':  '#8B5CF6',
  'Diploma':    'var(--color-warning)',
  'Contract':   '#059669',
  'VOG':        'var(--color-danger)',
  'Certificaat':'#EC4899',
  'Overig':     '#6B7280',
}

// Candidate statuses, funnel types and candidate types are no longer hardcoded —
// they come from the tenant config via LookupsContext (see context/LookupsContext).

// Stored value (stable for the backend) + i18n key for the label.
export const NOTE_TYPES: Array<{ value: string; key: string }> = [
  { value: 'Algemeen',     key: 'general' },
  { value: 'Intake',       key: 'intake' },
  { value: 'Feedback',     key: 'feedback' },
  { value: 'Afspraak',     key: 'appointment' },
  { value: 'Follow-up',    key: 'followup' },
  { value: 'Waarschuwing', key: 'warning' },
]

export const NL_PROVINCES: string[] = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland']

export const FUNCTION_LEVELS: string[] = ['Huishoudelijke hulp','Helpende','Helpende Plus','Verzorgende','Verzorgende IG','Verpleegkundige','Wijkverpleegkundige']

export const DRIVING_LICENCES: string[] = ['Rijbewijs B', 'Rijbewijs BE', 'Rijbewijs C', 'Rijbewijs CE', 'Rijbewijs D', 'Rijbewijs E']

export const ALL_FUNCTIONS: string[] = [
  'Doktersassistent', 'EVV\'er - UZK', 'EVV\'er - ZZP',
  'Helpende - UZK', 'Helpende - ZZP', 'Helpende Plus - UZK', 'Helpende Plus - ZZP',
  'Verpleegkundige Niveau 4 - UZK', 'Verpleegkundige Niveau 4 - ZZP',
  'Verpleegkundige Niveau 5 - UZK', 'Verpleegkundige Niveau 5 - ZZP',
  'Verzorgende IG - UZK', 'Verzorgende IG - ZZP',
]

export const ALL_POOLS: string[] = [
  'Doktersassistent', 'EVV\'er', 'Helpende', 'Helpende Plus',
  'Verpleegkundige Niveau 4 MBO', 'Verpleegkundige Niveau 5 HBO', 'Verzorgende IG',
]

// Section card styling used across the candidate tabs (note: title carries its own
// bottom margin, unlike the shared ui/SectionCard — kept for visual parity).
export const sectionBlock: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }
export const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }
