/**
 * usePageMemory — useState that survives page switches (and thus browser back).
 *
 * The shell unmounts a page on navigation, so filters/drawer state evaporated and
 * "terug" landed on a fresh page (Danny 2026-07-06). Values live in a module-level
 * store keyed per page+field, in MEMORY only (nothing auth/PII-shaped touches
 * localStorage — §8); a hard refresh starts clean, a tenant switch reloads the app
 * and clears it too (AuthContext hard-reloads on switch — isolation preserved).
 */
import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

const store = new Map<string, unknown>()

export function usePageMemory<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    store.has(key) ? (store.get(key) as T) : (typeof initial === 'function' ? (initial as () => T)() : initial))
  // Persist every change so the next mount of this page starts where it left off.
  useEffect(() => { store.set(key, value) }, [key, value])
  return [value, setValue]
}
