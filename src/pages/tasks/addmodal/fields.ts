/**
 * addmodal/fields — shared card chrome + picker footprint for AddTaskModal's three
 * titled cards (Taak/Planning/Koppeling). Card chrome (cardHead/cardBox/row2) is
 * re-exported from the shared `@/components/ui/modalCards` module (CLAUDE.md §11:
 * one source instead of a per-entity copy) so every "wide form" modal reads as one
 * system; only the task-specific picker footprint below stays local to this file.
 */
import type { CSSProperties } from 'react'

// Card chrome + 2-column row grid — the shared §3A card idiom, one source for
// every wide create-modal (see the module's own header for why).
export { cardHead, cardBox, row2 } from '@/components/ui/modalCards'
// House field footprint for every searchable picker in this modal (measured off
// the existing TextField/inputStyle: padding '8px 11px', fontSize 13, radius 8).
export const pickerStyle: CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }
export const PICKER_MENU_W = 260
