/**
 * useComposerFormatting — WA-COMPOSER-1: pure text-wrapping helpers for the
 * WhatsApp composer's bold/italic/strikethrough toolbar, plus a tiny hook that
 * applies a result to a live textarea (restores the caret/selection after the
 * value changes, since React re-renders reset it otherwise).
 */
import { useCallback, type RefObject } from 'react'

// The shape every helper below returns: the new full text plus where the
// selection should land afterwards (so the caret keeps making sense to the user).
export interface FormatResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

// Wraps [start, end) in `marker` on both sides; toggles OFF (unwraps) when the
// selection is already exactly wrapped by that marker. An empty selection
// inserts the marker pair and places the caret between them.
export function wrapSelection(text: string, start: number, end: number, marker: string): FormatResult {
  const before = text.slice(0, start)
  const selected = text.slice(start, end)
  const after = text.slice(end)
  const alreadyWrapped = before.endsWith(marker) && after.startsWith(marker)

  if (alreadyWrapped) {
    // Toggle: strip one marker from each side.
    const newBefore = before.slice(0, before.length - marker.length)
    const newAfter = after.slice(marker.length)
    const newText = newBefore + selected + newAfter
    return { text: newText, selectionStart: newBefore.length, selectionEnd: newBefore.length + selected.length }
  }

  if (start === end) {
    // No selection: insert the pair and put the caret between the markers.
    const newText = before + marker + marker + after
    const caret = before.length + marker.length
    return { text: newText, selectionStart: caret, selectionEnd: caret }
  }

  const newText = before + marker + selected + marker + after
  const newStart = before.length + marker.length
  return { text: newText, selectionStart: newStart, selectionEnd: newStart + selected.length }
}

// Inserts `snippet` at `pos` (e.g. an emoji at the caret) and places the caret
// right after the inserted text.
export function insertAt(text: string, pos: number, snippet: string): FormatResult {
  const newText = text.slice(0, pos) + snippet + text.slice(pos)
  const caret = pos + snippet.length
  return { text: newText, selectionStart: caret, selectionEnd: caret }
}

// Applies a FormatResult to a textarea ref: calls onChange with the new text,
// then restores the selection on the next frame (React must re-render with the
// new value first, or the browser clamps the selection to the stale length).
export function useApplyFormatResult(textareaRef: RefObject<HTMLTextAreaElement | null>, onChange: (text: string) => void) {
  return useCallback((result: FormatResult) => {
    onChange(result.text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) el.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }, [textareaRef, onChange])
}
