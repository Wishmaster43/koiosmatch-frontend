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
 * TWO things can be handed over, one protocol:
 *   draft — a half-typed NEW note (from the composer). It carries no note id, so
 *           the receiving window saves it as a new note. That is correct: it never
 *           existed anywhere else.
 *   edit  — ONE EXISTING note, by id (NOTITIE-POPOUT-EDIT-1, Danny 10-08: the
 *           pop-out icon now sits beside each note's pencil/bin and must open THAT
 *           note in the second screen's editor). Only the id travels — the window
 *           resolves it against the thread IT loaded and routes the save to that
 *           exact note, so no content is copied and no second note can appear.
 *           A window that cannot find the id (thread still loading, note not in
 *           its scope) simply never acks. And only entities whose popout window
 *           can really PATCH a note may be asked at all — see
 *           NOTE_EDIT_POPOUT_ENTITIES / `canHandOffNote`; a duplicate note is a
 *           worse outcome than no button.
 *
 * §8 — the draft never leaves the browser: same-origin BroadcastChannel, nothing
 * logged, nothing sent to any server. An `edit` message carries an id only, never
 * the note's text.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError } from '@/lib/notify'
import { noteDraftTopic, openNotesPopout, NOTE_EDIT_POPOUT_ENTITIES } from '@/lib/secondScreen'
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
  // CONCEPT-NOTE-1 (Danny 24-08): a cancelled composer hands its draft back as
  // a session concept — including the action panel's items, so the wizard
  // state survives a close/reopen too. The popout handoff simply omits it.
  items?: unknown[]
}

// The handoff vocabulary — mirroring the text popout's own, plus `edit` for an
// EXISTING note (id only, never its text — see the docblock).
type NoteDraftMessage =
  | { kind: 'hello' }
  | { kind: 'draft'; note: NoteDraft }
  | { kind: 'edit'; noteId: string }
  | { kind: 'ack' }

// What one in-flight handoff IS — stored verbatim so it is also the wire message
// (one shape, never a second mapping between state and protocol).
export type NoteHandoff = { kind: 'draft'; note: NoteDraft } | { kind: 'edit'; noteId: string }

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
  // Host side only: the window confirmed it holds the handoff. `kind` says WHAT it
  // took over, because only a `draft` has something here to close — an `edit` left
  // the note itself untouched in the list, so closing a composer on that ack would
  // throw away whatever else the recruiter happened to be writing.
  onHandedOver: (kind: NoteHandoff['kind']) => void
}

export function useNotesPopout({ target, onHandedOver }: NotesPopoutOptions) {
  const { t } = useTranslation('common')
  // Read the identity as primitives: hosts inline `popout={{…}}`, so the object
  // itself is a fresh reference on every render and would destabilise callbacks.
  const entity = target?.entity
  const id = target?.id
  const isWindow = target?.role === 'window'

  // Host: the handoff waiting to be taken over (null = nothing in flight).
  const [pending, setPending] = useState<NoteHandoff | null>(null)
  // Window: the draft this window received, until its composer took it over.
  const [incoming, setIncoming] = useState<NoteDraft | null>(null)
  // Window: the id of the EXISTING note this window was asked to open in its
  // editor, until its composer really shows that note (NOTITIE-POPOUT-EDIT-1).
  const [incomingNoteId, setIncomingNoteId] = useState<string | null>(null)
  // Mirrored in refs: onMessage is registered once and would otherwise read a
  // stale value, which is exactly how the second draft slipped past.
  const incomingRef = useRef<NoteDraft | null>(null)
  const incomingNoteIdRef = useRef<string | null>(null)

  // Latest callback + pending handoff for the message handler — refs so a reply is
  // never sent from a stale closure; assigned in an effect, never during render.
  const handedOverRef = useRef(onHandedOver)
  const pendingRef = useRef(pending)
  useEffect(() => { handedOverRef.current = onHandedOver; pendingRef.current = pending })
  // One ack per received handoff (the composer's effect fires on every render).
  const ackedRef = useRef(false)

  const post = useTextPopoutSync<NoteDraftMessage>({
    topic: entity && id ? noteDraftTopic(entity, id) : '',
    // The window listens from the start; the drill-down joins only while it is
    // actually handing something over, so an idle drawer opens no channel at all.
    enabled: Boolean(entity && id) && (isWindow || pending !== null),
    onMessage: message => {
      // Window side: adopt a handed-over draft or edit request — but ONLY when
      // this window is free. Refusing (no state change, no ack) is what makes the
      // handoff safe: the host never closes without an ack, so its text stays put
      // and the user gets the honest "not taken over" notice. Accepting here would
      // overwrite a note this window is still holding AND ack it, so the SECOND
      // half-typed note would exist nowhere — reproduced by the verify round
      // before this guard existed (body stayed on the first text while an ack went out).
      if (isWindow) {
        if (message.kind !== 'draft' && message.kind !== 'edit') return
        if (incomingRef.current || incomingNoteIdRef.current) return
        ackedRef.current = false
        if (message.kind === 'draft') setIncoming(message.note)
        else setIncomingNoteId(message.noteId)
        return
      }
      // Host side: a window just booted — replay whatever it was opened for.
      if (message.kind === 'hello') {
        if (pendingRef.current) post(pendingRef.current)
        return
      }
      // Host side: the window holds it — a draft's composer may close now (an edit
      // handoff has nothing here to close; see onHandedOver).
      if (message.kind === 'ack') {
        const kind = pendingRef.current?.kind
        setPending(null)
        if (kind) handedOverRef.current(kind)
      }
    },
  })

  // Window side: announce this window so an opener that is already waiting can
  // replay its draft into it.
  useEffect(() => { if (isWindow) post({ kind: 'hello' }) }, [isWindow, post])

  // Host side: post the handoff as soon as the channel is open — that reaches a
  // window that was ALREADY open (it will never send a second `hello`).
  useEffect(() => {
    if (isWindow || !pending) return
    post(pending)
  }, [isWindow, pending, post])

  // Window side: bound an edit request this window never resolved (note deleted
  // meanwhile, outside this window's scope, or its own composer stayed busy).
  // Without this it would sit here as "busy" forever and refuse every later
  // handoff. Safe to drop, and only here: an edit request carries no text (the
  // note itself is untouched on the server), while a held DRAFT is the only copy
  // of what someone typed and is therefore never dropped. Bounded by the same
  // window as the sender's own wait, which has by then told the recruiter.
  useEffect(() => {
    if (!isWindow || !incomingNoteId) return
    const timer = setTimeout(() => { if (!ackedRef.current) setIncomingNoteId(null) }, HANDOFF_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isWindow, incomingNoteId])

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

  // Host side, composer: open the window AND start the handoff. A blocked popup
  // never starts one — there would be nobody to take the text over.
  const handOff = useCallback((draft: NoteDraft) => {
    if (!entity || !id) return
    if (!openNotesPopout(entity, id)) { notifyError(t('popupBlocked')); return }
    setPending({ kind: 'draft', note: draft })
  }, [entity, id, t])

  // May this surface hand an EXISTING note over at all? Only a host (never the
  // window itself) of an entity whose popout can really save an edit — see
  // NOTE_EDIT_POPOUT_ENTITIES. False = render no button (§3), never a button that
  // would duplicate the note in the second screen.
  const canHandOffNote = Boolean(entity && id) && !isWindow && NOTE_EDIT_POPOUT_ENTITIES.has(entity as PopoutEntity)

  // Window side: called from the composer's own render pass, so the ack means
  // "the text is committed HERE" — the only thing that may close the other window.
  const ack = useCallback(() => {
    if (ackedRef.current) return
    ackedRef.current = true
    post({ kind: 'ack' })
  }, [post])

  // Keep the refs in step with the state they guard.
  useEffect(() => { incomingRef.current = incoming }, [incoming])
  useEffect(() => { incomingNoteIdRef.current = incomingNoteId }, [incomingNoteId])

  // Window side: the composer closed — forget both handoff kinds so a later note
  // never re-seeds from them and the window is free to receive again.
  const clearIncoming = useCallback(() => {
    incomingRef.current = null
    incomingNoteIdRef.current = null
    setIncoming(null)
    setIncomingNoteId(null)
  }, [])

  return { isWindow, handOff, canHandOffNote, pending: pending !== null, incoming, incomingNoteId, ack, clearIncoming }
}
