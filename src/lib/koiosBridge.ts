/**
 * koiosBridge — the one cross-cutting way a deeply nested component (an advice
 * row, a future entity surface) asks the singleton Koios panel to open with a
 * pre-filled question. Mirrors the existing 'km:open-changelog' global-event
 * convention (ChangelogPopover): the panel itself lives once in DashboardLayout,
 * so a component that has no access to its state dispatches this event instead
 * of prop-drilling an opener down through every intermediate layer.
 */
import type { KoiosContextRef } from '@/types/koios'

export const ASK_KOIOS_EVENT = 'km:ask-koios'

// Detail carried by the event: the composed question text to prefill (never sent),
// and optional context (the entity this advice row/action originates from).
export interface AskKoiosDetail {
  text: string
  ref?: KoiosContextRef
}

// Request the Koios panel to open (if closed) and prefill its composer with
// `text` — the user still presses send (API-CREDITS-1: never auto-submit).
// Optionally attach context (the entity this question is about).
export function askKoios(text: string, ref?: KoiosContextRef) {
  window.dispatchEvent(new CustomEvent<AskKoiosDetail>(ASK_KOIOS_EVENT, { detail: { text, ref } }))
}
