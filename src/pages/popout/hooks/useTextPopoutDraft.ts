/**
 * useTextPopoutDraft — the POPPED-OUT side of a free-text field (TEKST-POPOUT-1,
 * Danny 08-08 punt 2). Owns exactly one thing: the draft this window is editing,
 * and how it stays identical to the opener's.
 *
 * Hydration order matters and is the reason this is a hook, not three effects in
 * a page: the window boots, announces itself with `hello`, and the opener answers
 * with its CURRENT (possibly unsaved) draft — which must WIN over the server value
 * that the identity fetch delivers a moment later. `hydrated` records that the
 * editor already holds real text, so the slower of the two can never overwrite the
 * newer one.
 *
 * Saving is the host screen's own persistence path, injected as `onSave` — this
 * hook never talks to the API itself, so the field is written by exactly one
 * implementation (§11). A rejected save re-marks the draft dirty on BOTH windows,
 * so "saved" is never shown for text the server refused.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTextPopoutSync } from '@/hooks/useTextPopoutSync'

interface TextPopoutDraftOptions {
  // Sync topic — `textPopoutTopic(entity, id, field)` from lib/secondScreen.
  topic: string
  // The record's stored value; undefined while it is still loading.
  storedValue: string | undefined
  // Persist the field. `revert` runs when the server rejected the write. May
  // return a promise resolving TRUE on success, which is what lets a caller close
  // its window only once the text actually landed.
  onSave: (html: string, revert: () => void) => void | Promise<boolean>
}

export function useTextPopoutDraft({ topic, storedValue, onSave }: TextPopoutDraftOptions) {
  // null = the editor has no text yet (neither peer nor server has answered).
  const [text, setText] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  // True once real text landed — guards the late server value from clobbering a
  // newer peer draft (see the hydration note in the docblock).
  const hydratedRef = useRef(false)

  const post = useTextPopoutSync({
    topic,
    enabled: true,
    onMessage: message => {
      // `hello`: another window joined — it asks US for the draft only when we are
      // the opener; a popout answering a popout would just echo, so ignore it.
      if (message.kind === 'hello') return
      hydratedRef.current = true
      setText(message.html)
      setDirty(message.kind === 'draft')
    },
  })

  // Announce this window once the channel is open, so the opener can replay its
  // unsaved draft into it.
  useEffect(() => { post({ kind: 'hello' }) }, [post])

  // Adopt the stored value ONLY while nothing better is in the editor.
  useEffect(() => {
    if (hydratedRef.current || storedValue === undefined) return
    hydratedRef.current = true
    setText(storedValue)
  }, [storedValue])

  // One local edit — typing, dictation or an applied Koios suggestion.
  const change = useCallback((html: string) => {
    hydratedRef.current = true
    setText(html)
    setDirty(true)
    post({ kind: 'draft', html })
  }, [post])

  // Persist + tell the opener, so one save clears the unsaved marker in both
  // windows; a rejected write puts the marker back on both.
  // Resolves TRUE only when the write landed — a caller that closes on save must
  // never close on a REJECTED one, or the recruiter's text is gone with the window.
  const save = useCallback(async (): Promise<boolean> => {
    if (text === null) return false
    const html = text
    // Ack only AFTER the write lands — announcing "saved" before the await
    // let a refused write leave both windows optimistically clean (WALKTHROUGH-2108).
    const result = await onSave(html, () => { setDirty(true); post({ kind: 'draft', html }) })
    const landed = result !== false
    if (landed) {
      setDirty(false)
      post({ kind: 'saved', html })
    }
    return landed
  }, [text, post, onSave])

  return { text, dirty, change, save }
}
