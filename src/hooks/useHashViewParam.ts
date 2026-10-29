/**
 * useHashViewParam — reads a `?key=` value of this hash-routed SPA's location and keeps
 * it live: a same-page deep link (a bell click while the section is already open) only
 * fires `hashchange`, it never remounts the screen.
 */
import { useEffect, useState } from 'react'
import { getHashParams } from '@/lib/hashQuery'

// Returns the current hash-query value for `key` (null when absent), updated on hashchange.
export function useHashViewParam(key: string): string | null {
  const [value, setValue] = useState<string | null>(() => getHashParams(window.location.hash).get(key))
  // Re-read on every hash change; the listener goes away with the screen.
  useEffect(() => {
    const onChange = () => setValue(getHashParams(window.location.hash).get(key))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [key])
  return value
}
