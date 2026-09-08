/**
 * Shared shell of the popout identity hooks: fetch one record by id, map it,
 * expose an honest error state and a stable reload (the mount effect and the
 * exposed reload share it).
 */
import { useCallback, useEffect, useState } from 'react'

export function useLiteRecord<T>(
  id: string | undefined,
  fetchRecord: (id: string) => Promise<T>
): { record: T | null; loading: boolean; error: boolean; reload: () => void } {
  const [record, setRecord] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetches the record by id and maps it; stable via useCallback so the mount
  // effect and the exposed reload share one function.
  const load = useCallback(() => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    fetchRecord(id)
      .then((result) => setRecord(result))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, fetchRecord])

  // Runs the fetch once on mount (and again whenever load is recreated by an
  // id or fetchRecord change).
  useEffect(() => {
    load()
  }, [load])

  return { record, loading, error, reload: load }
}
