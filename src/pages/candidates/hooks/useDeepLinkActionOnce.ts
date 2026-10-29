import { useState } from 'react'

// Minimal deep-link shape the hook needs (see drawer/tabTarget).
interface DeepLinkLike { tab: string; action?: string }

// CONVERSATION-START-1: the deep-link 'start' action must fire ONCE per drawer
// open, not once per CommunicationTab mount. EntityDrawer remounts the active tab
// on every tab switch, so without this the modal would pop open again each time
// the user returns to Communicatie. Tracks the initialTab the action was consumed for.
export function useDeepLinkActionOnce(deepLink: DeepLinkLike | null, initialTab: string | undefined, resetKey?: unknown) {
  const [actionDoneFor, setActionDoneFor] = useState<string | undefined>(undefined)
  // A different record (resetKey) starts a fresh drawer open: forget the consumed action (render-time adjust).
  const [prevKey, setPrevKey] = useState(resetKey)
  if (resetKey !== prevKey) { setPrevKey(resetKey); setActionDoneFor(undefined) }
  const initialAction = deepLink?.tab === 'communication' && initialTab !== actionDoneFor ? deepLink.action : undefined
  return { initialAction, onInitialActionConsumed: () => setActionDoneFor(initialTab) }
}
