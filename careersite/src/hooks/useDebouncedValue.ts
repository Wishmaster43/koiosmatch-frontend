import { useEffect, useState } from 'react'

// Generic debounce hook — used to delay expensive filter changes (city/hours
// inputs) until the visitor pauses typing (CLAUDE.md §9: debounce expensive inputs).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  // Resets the timer on every value change; only the last value within delayMs sticks.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
