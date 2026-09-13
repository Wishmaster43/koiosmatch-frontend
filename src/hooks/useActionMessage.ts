import { useState, useRef, useEffect, useCallback } from 'react'
import type { ActionMessage } from '@/components/ui/ActionMessageBanner'

// Shows a transient action-result banner (bulk mutation success/error) and auto-dismisses
// it after 4s, clearing any pending timer first so an overlapping call can't cut a new
// message short. The ONE list-page notify mechanism (§3) — candidates, vacancies, …
export function useActionMessage() {
  const [actionMsg, setActionMsg] = useState<ActionMessage | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((type: string, text: string, action?: ActionMessage['action']) => {
    setActionMsg({ type, text, action })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }, [])

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  return { actionMsg, setActionMsg, notify }
}
