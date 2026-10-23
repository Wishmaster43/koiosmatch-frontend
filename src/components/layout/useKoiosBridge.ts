/**
 * useKoiosBridge: open state + pre-filled question of the singleton Koios panel,
 * fed by the shared window event.
 */
import { useState, useEffect } from 'react'
import { ASK_KOIOS_EVENT, type AskKoiosDetail } from '@/lib/koiosBridge'
import type { KoiosContextRef } from '@/types/koios'

// Owns the panel's open state and the question another screen asked it to show.
export function useKoiosBridge() {
  const [koiosOpen,      setKoiosOpen]      = useState(false)
  // KOIOS-ADVIES-DOORKLIK-1: a question composed elsewhere (an advice row) asks
  // the singleton panel to open pre-filled via the shared window event — see
  // src/lib/koiosBridge.ts. Consumed once by KoiosPanel, then cleared here.
  const [koiosQuestion,  setKoiosQuestion]  = useState<string | null>(null)
  const [koiosContextRef, setKoiosContextRef] = useState<KoiosContextRef | undefined>(undefined)
  useEffect(() => {
    const onAsk = (e: Event) => {
      const detail = (e as CustomEvent<AskKoiosDetail>).detail
      if (!detail?.text) return
      setKoiosQuestion(detail.text)
      setKoiosContextRef(detail.ref)
      setKoiosOpen(true)
    }
    window.addEventListener(ASK_KOIOS_EVENT, onAsk)
    return () => window.removeEventListener(ASK_KOIOS_EVENT, onAsk)
  }, [])
  return { koiosOpen, setKoiosOpen, koiosQuestion, setKoiosQuestion, koiosContextRef, setKoiosContextRef }
}
