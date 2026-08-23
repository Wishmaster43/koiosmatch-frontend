/**
 * useKoiosComposerKeys — the "@" mention picker's open/query/category state,
 * the roving-highlight wiring to KoiosMentionMenu's imperative handle, and the
 * mention-specific part of the composer textarea's keydown handling (ArrowUp/
 * ArrowDown/Enter-to-pick/Escape). Split out of KoiosPanel (§0.3 size
 * discipline, KOIOS-SEARCH-FIX-2) — the panel still owns `input`/`setInput`,
 * the send button and the context-ref chips; this hook owns everything
 * specific to "@". `handleKeyDown` returns whether it fully handled the key
 * (arrow-nav or a mention pick) — a plain Enter (nothing highlighted, or no
 * menu open) falls through unhandled so the panel's own submit stays in
 * charge of that decision, with no circular dependency on `submit` here. DOM
 * focus never leaves the textarea — the menu owns its own roving highlight
 * and reports back through the handle (moveHighlight/pickHighlighted), the
 * ARIA combobox-with-listbox-popup pattern (see KoiosMentionMenu's banner).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react'
import type { KoiosMentionMenuHandle } from './KoiosMentionMenu'
import type { KoiosEntityHit } from './useKoiosEntitySearch'
import { matchMentionQuery } from './mentionMatch'
import { resolveScopedQuery } from './mentionScope'
import { MENTION_CATEGORIES } from './koiosMentionCategories'
import type { MentionCategoryConfig } from './koiosMentionCategories'
import type { KoiosContextRef } from '@/types/koios'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'

interface UseKoiosComposerKeysArgs {
  input: string
  setInput: Dispatch<SetStateAction<string>>
  // Records a manual @-mention as an outgoing context ref — the panel owns the
  // actual dedupe/merge with the ambient chips, this hook only reports picks.
  addMentionRef: (ref: KoiosContextRef) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

export function useKoiosComposerKeys({ input, setInput, addMentionRef, textareaRef }: UseKoiosComposerKeysArgs) {
  const [showMention, setShowMention] = useState(false)
  const [mentionQ, setMentionQ] = useState('')
  // The category the user drilled into ("@Vacatures ") for a scoped search
  // (KOIOS-SEARCH-1) — null while showing the default candidate-quick-search +
  // category list. `label` is the exact text inserted, used to detect the
  // scoped query's prefix (mentionScope.resolveScopedQuery).
  const [activeCategory, setActiveCategory] = useState<{ id: string; label: string } | null>(null)
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null)
  // Whether KoiosMentionMenu actually painted a listbox this render (it can
  // return null below the char threshold, or a scoped query matching no
  // category) — ARIA state must never claim an expanded/controlled menu that
  // isn't in the DOM (KOIOS-SEARCH-FIX-2, mirrors onActiveOptionChange below).
  const [menuRendered, setMenuRendered] = useState(false)
  const mentionRef = useRef<HTMLDivElement>(null)
  const mentionMenuRef = useRef<KoiosMentionMenuHandle>(null)

  // Shared close — Escape, an outside click, a submit and "Nieuwe chat" all
  // funnel here. Stable identity (useCallback) so the outside-click effect
  // below can list it as a real dependency without re-subscribing every render.
  const closeMentionMenu = useCallback(() => { setShowMention(false); setActiveCategory(null) }, [])

  // The menu unmounts (in render, not literally) the instant showMention flips
  // false — reset the rendered flag with it so a stale `true` never survives
  // into the next open.
  useEffect(() => { if (!showMention) setMenuRendered(false) }, [showMention])

  // Close the mention picker on an outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isInsideDropdownPortal(e.target as Node)) return
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) closeMentionMenu()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [closeMentionMenu])

  // Track the "@" mention trigger from the composer's own onChange.
  // matchMentionQuery is unicode-safe and allows spaces (e.g. "@ahmed vos") —
  // see mentionMatch.ts for the space-handling fix. A scoped category is
  // dropped the moment the typed tail no longer starts with its label — the
  // user backspaced past it or started a fresh "@" elsewhere (mentionScope's
  // resolveScopedQuery is the single source of truth KoiosMentionMenu itself
  // uses for the same decision).
  const handleMentionInput = (val: string) => {
    const q = matchMentionQuery(val)
    if (q === null) { setShowMention(false); setActiveCategory(null); return }
    setShowMention(true)
    setMentionQ(q)
    if (activeCategory && resolveScopedQuery(q, activeCategory.label) === null) setActiveCategory(null)
  }

  // Keyboard nav across every "@" group: while the mention menu is open,
  // ArrowUp/ArrowDown/Enter are FORWARDED to it — DOM focus never leaves the
  // textarea, the menu owns its own roving highlight and reports back whether
  // it did anything. Returns true when this key was fully this hook's
  // business (arrow-nav, a mention pick, Escape) so the composer never ALSO
  // treats it as a plain Enter/newline.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (showMention && e.key === 'ArrowDown') {
      if (mentionMenuRef.current?.moveHighlight(1)) e.preventDefault()
      return true
    }
    if (showMention && e.key === 'ArrowUp') {
      if (mentionMenuRef.current?.moveHighlight(-1)) e.preventDefault()
      return true
    }
    if (e.key === 'Enter' && !e.shiftKey && showMention && mentionMenuRef.current?.pickHighlighted()) {
      e.preventDefault()
      return true
    }
    if (e.key === 'Escape') { closeMentionMenu(); return true }
    return false
  }

  // Picking a category inserts "@Label " as before. A category WITH search
  // wiring (koiosMentionCategories — every entry today) enters scoped mode —
  // the menu stays open and switches to a live search within that category;
  // one without (a future unwired entry) keeps the legacy text-only insert.
  const insertCategoryMention = (category: MentionCategoryConfig, label: string) => {
    const lastAt = input.lastIndexOf('@')
    const before = lastAt !== -1 ? input.slice(0, lastAt) : input
    setInput(before + '@' + label + ' ')
    if (category.search) {
      setActiveCategory({ id: category.id, label })
    } else {
      closeMentionMenu()
    }
    textareaRef.current?.focus()
  }

  // Picking a real record (default candidate quick-search OR a scoped category
  // search) ALSO records a context ref (via addMentionRef, deduped upstream)
  // so the outgoing turn carries { type, id } alongside the mention text —
  // resolvable types only are ever sent to the backend (koiosApi.sendChat),
  // the rest stay a UI-only pin.
  const insertEntityMention = (hit: KoiosEntityHit, categoryId: string) => {
    const refType = MENTION_CATEGORIES.find((c) => c.id === categoryId)?.search?.refType ?? categoryId
    const lastAt = input.lastIndexOf('@')
    const before = lastAt !== -1 ? input.slice(0, lastAt) : input
    setInput(before + '@' + hit.name + ' ')
    addMentionRef({ type: refType, id: hit.id, label: hit.name })
    closeMentionMenu()
    textareaRef.current?.focus()
  }

  // The "@" toolbar button — same trigger insert as typing "@" manually.
  const openMentionTrigger = () => {
    setInput(v => v + '@')
    setShowMention(true)
    setMentionQ('')
    setActiveCategory(null)
    textareaRef.current?.focus()
  }

  return {
    showMention, mentionQ, activeCategory, activeOptionId, setActiveOptionId, menuRendered, setMenuRendered,
    mentionRef, mentionMenuRef,
    handleMentionInput, handleKeyDown, insertCategoryMention, insertEntityMention, openMentionTrigger, closeMentionMenu,
  }
}
