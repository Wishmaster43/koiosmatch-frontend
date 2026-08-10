/**
 * useNotesPopout — everything the shared NotesTab needs to talk to its own
 * second-screen window (NOTITIE-POPOUT-HANDOFF-1, Danny 09/10-08: "werking
 * hetzelfde als icon profieltekst" — bij de profieltekst REIST DE TEKST MEE).
 *
 * Two roles, one protocol, one channel — the SAME BroadcastChannel the profile
 * text's pop-out uses (useTextPopoutSync), never a second synchronisation (§11):
 *   host   — the drill-down. Opens the window and, when the recruiter pops out
 *            mid-sentence, HANDS the half-typed note over: it posts the draft and
 *            waits for the window's `ack`.
 *   window — the popout itself. Announces itself with `hello` on boot, takes a
 *            draft over, and acks only once its own composer really holds it.
 *
 * NO TEXT LOSS is the whole point (Danny's belangrijkste eis). The composer closes
 * on `ack` and on nothing else. A blocked popup, a browser without
 * BroadcastChannel, a window whose own composer is already busy — all end the same
 * way: no ack, the composer stays open with the text still in it, and the
 * recruiter is told (§3, honest failure). The wait is BOUNDED: after
 * HANDOFF_TIMEOUT_MS the handoff is abandoned, so a late ack can never close a
 * composer the recruiter has meanwhile kept typing in.
 *
 * NEW notes only. A draft carries no note id, so a receiving window would save it
 * as a new note — handing over an EDIT needs the window to route the save to that
 * exact note, which two of the three popout routes cannot do at all today
 * (customer/vacancy popouts wire only addNote). The composer therefore shows no
 * pop-out icon while editing an existing note, rather than dropping the text.
 *
 * §8 — the draft never leaves the browser: same-origin BroadcastChannel, nothing
 * logged, nothing sent to any server.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError } from '@/lib/notify'
import { noteDraftTopic, openNotesPopout } from '@/lib/secondScreen'
import type { PopoutEntity } from '@/lib/secondScreen'
import { useTextPopoutSync } from './useTextPopoutSync'

// One half-typed NEW note — exactly the fields the composer owns. All of them
// travel: type, contact channel, title and language are recruiter INPUT just like
// the body, and re-picking them in the second window is the same lost work.
export interface NoteDraft {
  type: string
  channel: string
  title: string
  body: string
  language?: string
}

// The handoff vocabulary — three messages, mirroring the text popout's own.
type NoteDraftMessage = { kind: 'hello' } | { kind: 'draft'; note: NoteDraft } | { kind: 'ack' }

// Which record this notes surface belongs to, and which side of the glass it is on.
export interface NotesPopoutTarget {
  entity: PopoutEntity
  id: string
  // 'window' = this render IS the second screen: it receives drafts and never
  // renders a button that would re-open itself. Default 'host' = the drill-down.
  role?: 'host' | 'window'
}

// How long the drill-down waits for the window to confirm it took the draft over.
// Generous on purpose: a cold second window boots the whole SPA before it can
// answer. Expiring is safe — the text simply stays where it already is.
const HANDOFF_TIMEOUT_MS = 8000

interface NotesPopoutOptions {
  target?: NotesPopoutTarget
  // Host side only: the window confirmed it holds the draft — the composer may close.
  onHandedOver: () => void
}

export function useNotesPopout({ target, onHandedOver }: NotesPopoutOptions) {
  const { t } = useTranslation('common')
  // Read the identity as primitives: hosts inline `popout={{…}}`, so the object
  // itself is a fresh reference on every render and would destabilise callbacks.
  const entity = target?.entity
  const id = target?.id
  const isWindow = target?.role === 'window'

  // Host: the draft waiting to be taken over (null = nothing in flight).
  const [pending, setPending] = useState<NoteDraft | null>(null)
  // Window: the draft this window received, until its composer took it over.
  const [incoming, setIncoming] = useState<NoteDraft | null>(null)
  // Mirrored in a ref: onMessage is registered once and would otherwise read a
  // stale `incoming`, which is exactly how the second draft slipped past.
  const incomingRef = useRef<NoteDraft | null>(null)

  // Latest callback + pending draft for the message handler — refs so a reply is
  // never sent from a stale closure; assigned in an effect, never during render.
  const handedOverRef = useRef(onHandedOver)
  const pendingRef = useRef(pending)
  useEffect(() => { handedOverRef.current = onHandedOver; pendingRef.current = pending })
  // One ack per received draft (the composer's effect fires on every render).
  const ackedRef = useRef(false)

  const post = useTextPopoutSync<NoteDraftMessage>({
    topic: entity && id ? noteDraftTopic(entity, id) : '',
    // The window listens from the start; the drill-down joins only while it is
    // actually handing something over, so an idle drawer opens no channel at all.
    enabled: Boolean(entity && id) && (isWindow || pending !== null),
    onMessage: message => {
      // Window side: adopt a handed-over draft — but ONLY when this window is
      // free. Refusing (no state change, no ack) is what makes the handoff safe:
      // the host never closes without an ack, so its text stays put and the user
      // gets the honest "not taken over" notice. Accepting here would overwrite a
      // note this window is still holding AND ack it, so the SECOND half-typed
      // note would exist nowhere — reproduced by the verify round before this
      // guard existed (body stayed on the first text while an ack went out).
      if (isWindow) {
        if (message.kind !== 'draft') return
        if (incomingRef.current) return
        ackedRef.current = false
        setIncoming(message.note)
        return
      }
      // Host side: a window just booted — replay the draft it was opened for.
      if (message.kind === 'hello') {
        if (pendingRef.current) post({ kind: 'draft', note: pendingRef.current })
        return
      }
      // Host side: the window holds the text — the composer may close now.
      if (message.kind === 'ack') {
        setPending(null)
        handedOverRef.current()
      }
    },
  })

  // Window side: announce this window so an opener that is already waiting can
  // replay its draft into it.
  useEffect(() => { if (isWindow) post({ kind: 'hello' }) }, [isWindow, post])

  // Host side: post the draft as soon as the channel is open — that reaches a
  // window that was ALREADY open (it will never send a second `hello`).
  useEffect(() => {
    if (isWindow || !pending) return
    post({ kind: 'draft', note: pending })
  }, [isWindow, pending, post])

  // Host side: bound the wait. On expiry the handoff is abandoned — the composer
  // stays open with the text in it and the recruiter is told why.
  useEffect(() => {
    if (isWindow || !pending) return
    const timer = setTimeout(() => {
      setPending(null)
      notifyError(t('popoutHandoffFailed'))
    }, HANDOFF_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isWindow, pending, t])

  // Host side, toolbar: just open (or re-focus) the window — nothing to hand over.
  const open = useCallback(() => {
    if (!entity || !id) return
    if (!openNotesPopout(entity, id)) notifyError(t('popupBlocked'))
  }, [entity, id, t])

  // Host side, composer: open the window AND start the handoff. A blocked popup
  // never starts one — there would be nobody to take the text over.
  const handOff = useCallback((draft: NoteDraft) => {
    if (!entity || !id) return
    if (!openNotesPopout(entity, id)) { notifyError(t('popupBlocked')); return }
    setPending(draft)
  }, [entity, id, t])

  // Window side: called from the composer's own render pass, so the ack means
  // "the text is committed HERE" — the only thing that may close the other window.
  const ack = useCallback(() => {
    if (ackedRef.current) return
    ackedRef.current = true
    post({ kind: 'ack' })
  }, [post])

  // Window side: the composer closed — forget the draft so a later note never
  // re-seeds from it.
  // Keep the ref in step with the state it guards.
  useEffect(() => { incomingRef.current = incoming }, [incoming])

  const clearIncoming = useCallback(() => { incomingRef.current = null; setIncoming(null) }, [])

  return { isWindow, open, handOff, pending: pending !== null, incoming, ack, clearIncoming }
}
