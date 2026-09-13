import { useState, useCallback } from 'react'

// Row selection that toggles off when the same row is clicked again (drawer-close-on-reclick
// convention repeated across every Shiftmanager mirror list). `T` must carry an `id`.
export function useToggleSelected<T extends { id?: unknown }>() {
  const [selected, setSelected] = useState<T | null>(null)
  // Selecting the already-selected row closes it; any other row replaces the selection.
  const toggleSelected = useCallback((row: T) => {
    setSelected(prev => (prev?.id === row.id ? null : row))
  }, [])
  return { selected, setSelected, toggleSelected }
}
