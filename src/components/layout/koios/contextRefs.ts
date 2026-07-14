/**
 * contextRefs — pure helpers for the composer's @-mention context list
 * (KOIOS-CTX-1). Kept side-effect free so KoiosPanel's state updates stay
 * one-liners and the dedupe rule is unit-testable in isolation.
 */
import type { KoiosContextRef } from '@/types/koios'

// Add a ref only if its id isn't already tracked — picking the same candidate
// twice must not duplicate the chip or the outgoing context array.
export function addContextRef(list: KoiosContextRef[], ref: KoiosContextRef): KoiosContextRef[] {
  return list.some((r) => r.id === ref.id) ? list : [...list, ref]
}

// Remove one ref by id (the chip's ✕ button).
export function removeContextRef(list: KoiosContextRef[], id: string): KoiosContextRef[] {
  return list.filter((r) => r.id !== id)
}
