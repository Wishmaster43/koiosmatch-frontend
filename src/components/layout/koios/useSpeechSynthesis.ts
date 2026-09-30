/**
 * useSpeechSynthesis — wraps the browser's SpeechSynthesis API (VOICE-MODE-1)
 * so Koios can speak its replies aloud in conversation mode. Feature-detects
 * once per mount; `speak` always cancels any running utterance first, so two
 * quick answers never overlap, and `speaking` tracks the utterance lifecycle
 * for the caller's UI (e.g. an aria-busy toggle).
 */
import { useCallback, useEffect, useState } from 'react'

// Strip markdown formatting from an assistant answer so speech synthesis reads
// plain prose instead of literal asterisks/hashes/pipes/link syntax.
export function toSpeakableText(answer: string): string {
  return answer
    .replace(/```[\s\S]*?```/g, ' ')           // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/^#{1,6}\s+/gm, '')               // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links → visible text
    .replace(/(\*\*|__)(.*?)\1/g, '$2')        // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')           // italic
    .replace(/^\s*[-*]\s+/gm, '')              // bullet list markers
    .replace(/^\s*\d+\.\s+/gm, '')             // numbered list markers
    .replace(/\|/g, ' ')                       // table pipes
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim()
}

// Feature-detects the SpeechSynthesis API once (lazy useState initializer, so
// it never re-runs on a later render) and exposes speak/cancel + speaking state.
export function useSpeechSynthesis() {
  const [supported] = useState(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
  )
  const [speaking, setSpeaking] = useState(false)

  // Never leave Koios talking after the component unmounts (panel closed).
  // Optional-chained rather than gated on the captured `supported` flag: the
  // API can disappear between mount and unmount (e.g. test teardown order),
  // and an unmount handler must never throw.
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  // Cancel any running utterance, then queue a fresh one for text/lang.
  // `voiceName` (VOICE-SETTINGS-1): applied only when it names a voice CURRENTLY
  // present in getVoices() — a stale/remote name (tenant switched browsers, or the
  // picked voice is no longer local) falls back to the first LOCAL voice for this
  // language (never a remote one — §8: the read-aloud path must never risk sending
  // text to a server-side voice), and only when none exists is utterance.voice left
  // unset (true, unpickable browser default).
  const speak = useCallback((text: string, lang: string, voiceName?: string | null) => {
    if (!supported || !text || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    const voices = window.speechSynthesis.getVoices?.() ?? []
    const named = voiceName ? voices.find(v => v.name === voiceName && v.localService === true) : undefined
    const langPrefix = lang.split('-')[0]
    const localFallback = named ?? voices.find(v => v.localService === true && v.lang?.split('-')[0] === langPrefix)
    if (localFallback) utterance.voice = localFallback
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [supported])

  // Stop any running speech immediately (mode switched off / panel closed).
  const cancel = useCallback(() => {
    if (!supported) return
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [supported])

  return { supported, speaking, speak, cancel }
}
