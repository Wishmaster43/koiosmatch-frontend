/**
 * Application drawer constants — the return-tab memory (NAV-BACK-1 tab-remember,
 * mirrors pages/candidates/drawer/constants.ts). Cross-navigating away from a
 * subtab (Kandidaat → full candidate page, Vacature → full vacancy page) stashes
 * which subtab was active, so browser BACK reopens THIS application's drawer on
 * the SAME subtab instead of resetting to Sollicitatie. In-memory only (a plain
 * module-scope Map, not sessionStorage) — it only needs to survive one
 * unmount/remount round-trip within this SPA session. Peek is non-destructive
 * (safe to call during render, incl. under StrictMode's double-invoke); clear is
 * destructive and must only run from an effect (consume-once, so a later
 * unrelated re-open of the same application defaults back to Sollicitatie).
 */
import type { Id } from '@/types/common'

const returnTabMemory = new Map<string, string>()
export const rememberReturnTab = (id: Id, tab: string) => { returnTabMemory.set(String(id), tab) }
export const peekReturnTab = (id: Id): string | null => returnTabMemory.get(String(id)) ?? null
export const clearReturnTab = (id: Id) => { returnTabMemory.delete(String(id)) }
