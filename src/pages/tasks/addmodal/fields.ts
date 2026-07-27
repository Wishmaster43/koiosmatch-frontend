/**
 * addmodal/fields — shared card chrome + picker footprint for AddTaskModal's three
 * titled cards (Taak/Planning/Koppeling). Mirrors pages/candidates/addmodal/fields'
 * cardHead/cardBox exactly (the §3A card idiom), but declared locally: CLAUDE.md §2
 * forbids a cross-entity import of another entity page's internals (pages/tasks
 * reaching into pages/candidates), so this small chrome duplicates the shared
 * visual spec instead of importing across entities.
 */
import type { CSSProperties } from 'react'

// Card heading — 11px uppercase muted, above a bordered surface (matches the
// drill-down ProfileTab / +Match card idiom so every "wide form" modal reads as one system).
export const cardHead: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
export const cardBox: CSSProperties = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }
// One 2-column grid row shared by every card — the paired-field layout Danny asked for.
export const row2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
// House field footprint for every searchable picker in this modal (measured off
// the existing TextField/inputStyle: padding '8px 11px', fontSize 13, radius 8).
export const pickerStyle: CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }
export const PICKER_MENU_W = 260
