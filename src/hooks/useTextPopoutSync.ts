/**
 * useTextPopoutSync — the ONE cross-window channel a popped-out free-text field
 * and its opener talk over (TEKST-POPOUT-1, Danny 08-08 punt 2: "het pop-out-
 * venster bewerkt DEZELFDE tekst"). A real second browser window is a separate
 * document, so the two editors share nothing by default; BroadcastChannel (same
 * origin, no server round-trip) mirrors the draft between them live.
 *
 * Three messages, deliberately tiny:
 *   hello — a freshly opened window announces itself; the opener answers with its
 *           CURRENT draft, so popping out mid-sentence never loses what was typed.
 *   draft — someone typed/dictated/applied Koios assist: the other side adopts it
 *           (RichTextEditor's own external-value sync puts it in the editor).
 *   saved — someone persisted the field: the other side adopts the value AND drops
 *           its unsaved marker, so one save clears both windows.
 *
 * BroadcastChannel never delivers a message back to the context that posted it,
 * so there is no echo loop to guard against. A browser without it (or jsdom in
 * tests) degrades honestly: both windows still load and SAVE through the API on
 * their own, they just stop mirroring keystrokes — never a broken affordance.
 *
 * NO PII IN THE PAYLOAD BEYOND THE FIELD ITSELF (§8): the draft text is the thing
 * being edited and never leaves the browser — nothing is logged, nothing is sent.
 */
import { useCallback, useEffect, useRef } from 'react'

// The full message vocabulary — both windows implement the same three cases.
export type TextPopoutMessage =
  | { kind: 'hello' }
  | { kind: 'draft'; html: string }
  | { kind: 'saved'; html: string }

interface TextPopoutSyncOptions {
  // Channel topic — build it with `textPopoutTopic()` (lib/secondScreen).
  topic: string
  // Off until there is something to mirror (the opener only joins once it has
  // actually popped the field out), so an idle drawer opens no channels.
  enabled: boolean
  onMessage: (message: TextPopoutMessage) => void
}

// Returns a stable `post` — a no-op while the channel is closed or unsupported.
export function useTextPopoutSync({ topic, enabled, onMessage }: TextPopoutSyncOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  // Keep the handler on its latest closure so a message always sees current state;
  // assigned in an effect, never during render.
  const handlerRef = useRef(onMessage)
  useEffect(() => { handlerRef.current = onMessage })

  // Open the channel for this topic; close it on unmount/disable. StrictMode's
  // setup→cleanup→setup is safe here: the ref is re-armed in SETUP (§9).
  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(topic)
    channel.onmessage = (event: MessageEvent) => handlerRef.current(event.data as TextPopoutMessage)
    channelRef.current = channel
    return () => {
      channelRef.current = null
      channel.close()
    }
  }, [topic, enabled])

  return useCallback((message: TextPopoutMessage) => {
    channelRef.current?.postMessage(message)
  }, [])
}
