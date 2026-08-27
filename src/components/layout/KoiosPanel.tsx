/**
 * KoiosPanel — the sliding chat panel that is Koios AI's one conversational
 * surface app-wide (§0B): message list, composer with @-mention context refs,
 * voice dictation, model picker and resizable width. Presentational pieces
 * (message bubble, typing indicator, panel chrome) live here; state and the
 * actual /ai/koios/chat call are split into the co-located koios/ hooks so
 * this file stays the composition layer, not the logic.
 */
import { useState, useRef, useEffect } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AtSign, Paperclip, ArrowUp, Sparkles, Lightbulb } from 'lucide-react'
import { useLocale } from '@/lib/datetime'
import { tint, TINT_BORDER } from '@/lib/tint'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useKoiosChat } from './koios/useKoiosChat'
import { useKoiosSettings } from './koios/useKoiosSettings'
import { useKoiosPanelWidth } from './koios/useKoiosPanelWidth'
import { useKoiosMentionCounts } from './koios/useKoiosMentionCounts'
import { useKoiosContextChips } from './koios/useKoiosContextChips'
import { useKoiosComposerKeys } from './koios/useKoiosComposerKeys'
import { addContextRef, removeContextRef } from './koios/contextRefs'
import KoiosMessage from './koios/KoiosMessage'
import TypingIndicator from './koios/TypingIndicator'
import KoiosModelPicker from './koios/KoiosModelPicker'
import KoiosMentionMenu from './koios/KoiosMentionMenu'
import KoiosContextChips from './koios/KoiosContextChips'
import type { KoiosContextChipRow } from './koios/KoiosContextChips'
import KoiosHeader from './koios/KoiosHeader'
import KoiosResizeHandle from './koios/KoiosResizeHandle'
import KoiosRadar from './koios/KoiosRadar'
import Button from '@/components/ui/Button'
import { useKoiosRadarCollapse } from './koios/useKoiosRadarCollapse'
import KoiosAssistantBlock from './koios/KoiosAssistantBlock'
import KoiosVoiceButton from './koios/KoiosVoiceButton'
import type { KoiosContextRef } from '@/types/koios'

// ── Main panel ────────────────────────────────────────────────────────────────
export default function KoiosPanel({ open, onClose, onNavigate }: { open?: boolean; onClose?: () => void; onNavigate?: (page: string, intent?: unknown) => void }) {
  const { t } = useTranslation('common')
  const locale = useLocale()
  // All chat state + the synchronous /ai/koios/chat call live in the hook.
  const { messages, loading, model, setModel, send, reset } = useKoiosChat()
  // Landing state = no real conversation yet (only the intro bubble) — the Koios
  // Advies radar (Danny 21/7) REPLACES that welcome text, it doesn't sit beside it.
  const isLanding = messages.length === 1 && messages[0].kind === 'welcome'
  // Settings (selectable models + connection status), loaded on first open.
  const { settings } = useKoiosSettings(open)
  // Free-drag width, persisted in px across reloads (§ resizable Koios panel).
  // The toggle button still snaps between the two known presets — see the hook.
  const { width, minWidth, maxWidth, isExpanded, isDragging, toggle: toggleExpanded, startDrag, onHandleKeyDown } = useKoiosPanelWidth()
  // Connection status (optimistic until loaded; only `false` flips to "offline").
  // `api_ok` is the backend's live probe — it also catches credit exhaustion, not
  // just a missing key, so a tenant with an empty balance no longer shows "online".
  const connected = settings?.status?.claude_configured !== false && settings?.status?.api_ok !== false
  const [input,   setInput]   = useState('')
  // Danny 27-08: each landing card can be closed AWAY entirely (X on the card,
  // or the composer toggles below); persisted per user like the collapse state.
  const { collapsed: suggestionsHidden, setCollapsed: setSuggestionsHidden } = useKoiosRadarCollapse('koios.assistant.hidden')
  const { collapsed: adviceHidden, setCollapsed: setAdviceHidden } = useKoiosRadarCollapse('koios.radar.hidden')
  const [focused, setFocused] = useState(false)
  // @-mentioned records for the outgoing turn (KOIOS-CTX-1) — shown as removable
  // chips above the composer; cleared on send and on "Nieuwe chat".
  const [contextRefs, setContextRefs] = useState<KoiosContextRef[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  // The "@" mention picker's open/query/category state, roving-highlight wiring
  // and keydown forwarding all live in one hook (§0.3 size split, KOIOS-SEARCH-FIX-2).
  const {
    showMention, mentionQ, activeCategory, activeOptionId, setActiveOptionId, menuRendered, setMenuRendered,
    mentionRef, mentionMenuRef, handleMentionInput, handleKeyDown, insertCategoryMention, insertEntityMention,
    openMentionTrigger, closeMentionMenu,
  } = useKoiosComposerKeys({
    input, setInput,
    addMentionRef: (ref) => setContextRefs(prev => addContextRef(prev, ref)),
    textareaRef,
  })
  // prefers-reduced-motion (§6) — now the shared hook (§11: the drag layer needed the
  // same signal, so this inline copy was promoted instead of duplicated).
  const reduceMotion = usePrefersReducedMotion()
  // Real tenant counts for the mention categories — fetched once, lazily, the
  // first time the menu opens (never blocks the menu's first paint).
  const mentionCounts = useKoiosMentionCounts(showMention)
  // KOIOS-SELECTIE-CONTEXT-1: the two AMBIENT context chips (open drilldown +
  // table selection) — derived, not user-added, see the hook's own comment.
  const { ambientRef, selectionChip, dismissAmbient, dismissSelection } = useKoiosContextChips()

  // Keep the latest message in view.
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Auto-resize the textarea up to a cap.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
  }, [input])

  // Submit the composer: hand the text + ALL context refs (ambient + selection +
  // manual @-mentions, see chipRows below) to the hook, then clear + refocus.
  // Ambient/selection are ongoing page state, not a per-turn pick, so only the
  // manual list resets on send.
  const submit = (text?: string) => {
    const trimmed = (text ?? '').trim()
    if (!trimmed || loading) return
    send(trimmed, outgoingContextRefs)
    setInput('')
    setContextRefs([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    closeMentionMenu()
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Composer onChange: update the draft text, then let the mention hook decide
  // whether the "@" picker should open/update from the new value.
  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    handleMentionInput(val)
  }

  // Composer onKeyDown: the mention hook gets first refusal (arrow-nav, a
  // mention pick, Escape) — a plain Enter it does NOT consume falls through to
  // the real submit here, so "Enter picks a highlighted row" and "Enter sends
  // the message" can never both fire for the same keystroke.
  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input) }
  }

  // KOIOS-SELECTIE-CONTEXT-1: the ambient chips display FIRST, then the manual
  // @-mentions. Deduped by id, but the LAST entry for a given id wins the
  // rendered content (a Map.set on an existing key updates the value without
  // moving its position) — so a manual @-mention of the record that's ALSO the
  // open drilldown keeps its real name (hit.name) instead of the ambient
  // chip's generic "<entity> #<id>" fallback, while still showing in the
  // ambient slot's FIRST position.
  // The selection chip is ONE display pill (its own synthetic key, never sent
  // as-is) — its REAL per-record refs are folded into outgoingContextRefs below.
  const chipSource: KoiosContextChipRow[] = [
    ...(ambientRef ? [{ ref: ambientRef, onRemove: dismissAmbient }] : []),
    ...(selectionChip ? [{
      ref: { type: selectionChip.refs[0]?.type ?? selectionChip.id, id: selectionChip.id, label: selectionChip.label },
      onRemove: dismissSelection,
    }] : []),
    ...contextRefs.map((ref) => ({ ref, onRemove: () => removeContext(ref.id) })),
  ]
  const chipsById = new Map<string, KoiosContextChipRow>()
  for (const row of chipSource) chipsById.set(row.ref.id, row)
  const chipRows = Array.from(chipsById.values())

  // The OUTGOING turn carries the REAL refs — ambient + every selected record
  // (singular ref type, capped) + manual mentions — deduped by id so a record
  // that is both open AND selected/mentioned is only ever sent once.
  const outgoingSource: KoiosContextRef[] = [
    ...(ambientRef ? [ambientRef] : []),
    ...(selectionChip ? selectionChip.refs : []),
    ...contextRefs,
  ]
  const seenOutgoingIds = new Set<string>()
  const outgoingContextRefs = outgoingSource.filter((ref) => (seenOutgoingIds.has(ref.id) ? false : (seenOutgoingIds.add(ref.id), true)))

  const removeContext = (id: string) => setContextRefs(prev => removeContextRef(prev, id))

  // Dictation (SPEECH-1): append a recognized chunk to the draft, spacing it
  // off the existing text, then refocus so typing can resume mid-dictation.
  const appendVoiceText = (chunk: string) => {
    setInput(prev => {
      const needsSpace = prev.length > 0 && !/\s$/.test(prev)
      return prev + (needsSpace ? ' ' : '') + chunk
    })
    textareaRef.current?.focus()
  }

  const newChat = () => { reset(); setInput(''); closeMentionMenu(); setContextRefs([]) }

  // CONNECT-1 (Danny 22-08): the header's disconnected indicator jumps straight
  // to the screen that configures this connection (Settings → AI → Koios,
  // KoiosStatusCard) via SettingsPage's canonical #settings/<category>/<tab>
  // hash contract. `onNavigate` already pushes a '#settings' history entry, so
  // the deep sub-tab hash REPLACES that entry (a second push would make Back
  // land on the rejected bare '#settings' — the documented dead-Back trap in
  // DashboardLayout); replaceState fires no hashchange, so an already-mounted
  // SettingsPage is told explicitly.
  const goToKoiosSettings = () => {
    onNavigate?.('settings')
    window.history.replaceState(null, '', '#settings/ai/koios')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  if (!open) return null

  return (
    <div style={{ width, flexShrink: 0, position: 'relative',
      borderRight: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)', height: '100%',
      display: 'flex', flexDirection: 'column',
      // No transition while a live drag is in progress (it would fight the
      // pointer position) and none for users who opted out of motion (§6).
      transition: isDragging || reduceMotion ? 'none' : 'width 0.2s ease' }}>

      {/* ── Header ── */}
      <KoiosHeader connected={connected} expanded={isExpanded} onNewChat={newChat}
        onToggleExpanded={toggleExpanded} onClose={onClose} onConfigure={goToKoiosSettings} t={t} />

      {/* ── Resize handle: drag or arrow-keys to resize, Home/End to the bounds ── */}
      <KoiosResizeHandle width={width} minWidth={minWidth} maxWidth={maxWidth}
        onPointerDown={startDrag} onKeyDown={onHandleKeyDown} t={t} />

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLanding ? (
          // Assistant block ABOVE the radar (§0B: the assistant's opening move).
          <>
            {/* Chat-handoff (golf 2): a suggestion prefills the composer and
                focuses it — SENDING stays the user's own explicit click. */}
            {!suggestionsHidden && (
              <KoiosAssistantBlock onClose={() => setSuggestionsHidden(true)}
                onAskKoios={text => { setInput(text); setTimeout(() => textareaRef.current?.focus(), 50) }} />
            )}
            {!adviceHidden && <KoiosRadar onNavigate={onNavigate} onClose={() => setAdviceHidden(true)} />}
          </>
        ) : (
          messages.map((msg, i) => (
            <KoiosMessage key={i} msg={msg} isNew={i === messages.length - 1} t={t} locale={locale} modelOptions={settings?.models?.options} />
          ))
        )}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>


      {/* ── Input area ── */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0, position: 'relative' }}>

        {/* Mention picker — scoped per-category search + candidate quick-search + category list */}
        {showMention && (
          <KoiosMentionMenu
            ref={mentionMenuRef}
            query={mentionQ}
            counts={mentionCounts}
            activeCategoryId={activeCategory?.id ?? null}
            activeCategoryLabel={activeCategory?.label ?? null}
            onPickCategory={insertCategoryMention}
            onPickEntity={insertEntityMention}
            t={t}
            locale={locale}
            menuRef={mentionRef}
            onActiveOptionChange={setActiveOptionId}
            onOpenChange={setMenuRendered}
          />
        )}

        {/* Context chips: ambient (open drilldown + table selection) + manual
            @-mentions — one removable row, see KoiosContextChips + chipRows above. */}
        <KoiosContextChips chips={chipRows} t={t} />

        {/* Input box */}
        <div style={{
          background: 'var(--surface)',
          border: `1.5px solid ${focused ? 'var(--color-primary)' : 'var(--border)'}`,
          borderRadius: 20,
          padding: '10px 10px 8px 14px',
          // HUISSTIJL-1: focused state is an inset focus ring (kept as-is); resting state is a card-level shadow.
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'var(--shadow-card)',
          transition: 'border-color var(--motion-fast), box-shadow var(--motion-fast)',
        }}>
          {/* ARIA-in-HTML formally disallows role="combobox" on a <textarea>, but the
              composer doubles as the mention-combobox input by design: it drives the
              floating KoiosMentionMenu listbox via aria-activedescendant while staying
              the one place the user types, so wrapping it in an indirection <div> would
              break the existing activedescendant wiring for no accessibility gain. This
              follows the ARIA 1.2 combobox pattern (editable combobox with list popup),
              which allows the combobox role on any single/multi-line text input. */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={onComposerKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('koios.taskPlaceholder')}
            rows={1}
            role="combobox"
            // aria-expanded/aria-controls/aria-activedescendant only describe the
            // menu while it is ACTUALLY rendered (menuRendered, reported by
            // KoiosMentionMenu's own onOpenChange) — showMention alone can be true
            // while the menu itself paints nothing (below the char threshold).
            aria-expanded={showMention && menuRendered}
            aria-controls={showMention && menuRendered ? 'koios-mention-menu' : undefined}
            aria-activedescendant={showMention && menuRendered && activeOptionId ? activeOptionId : undefined}
            aria-autocomplete="list"
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the composer's own <textarea> control, not a text-display atom; BodyText renders a <p>/<span> and cannot back a form control
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              resize: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
              lineHeight: 1.5, overflowY: 'hidden', display: 'block', marginBottom: 8,
            }}
          />

          {/* Toolbar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* @ mention */}
            <button
              onClick={openMentionTrigger}
              title={t('koios.addContext')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- imperative two-property hover swap (background AND ink together); not a static Button variant
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px',
                borderRadius: 7, color: 'var(--sidebar-muted)', display: 'flex',
                transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' }}>
              <AtSign size={14} />
            </button>

            {/* Paperclip — no upload path exists yet, so it renders honestly disabled (§3: no fake affordances). */}
            <button
              disabled aria-disabled="true"
              title={`${t('koios.attachFile')} — ${t('common:comingSoon')}`}
              aria-label={`${t('koios.attachFile')} — ${t('common:comingSoon')}`}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- disabled placeholder in the composer icon row; not a Button-variant action
              style={{ background: 'none', border: 'none', cursor: 'default', padding: '4px 5px',
                borderRadius: 7, color: 'var(--sidebar-muted)', display: 'flex', opacity: 0.45 }}>
              <Paperclip size={14} />
            </button>

            {/* Danny 27-08: the two landing cards are summonable/dismissable from
                the composer — visible = primary ink, closed = muted (aria-pressed). */}
            {isLanding && (
              <>
                {/* Shared ghost Button carries the identity; the STATE rides in the
                    glyph colour (primary = visible, muted = closed) + aria-pressed. */}
                <Button variant="ghost" iconOnly size="sm" aria-pressed={!suggestionsHidden}
                  aria-label={t('koios.assistant.title')} title={t('koios.assistant.title')}
                  onClick={() => setSuggestionsHidden(!suggestionsHidden)}>
                  <Sparkles size={14} color={suggestionsHidden ? 'var(--sidebar-muted)' : 'var(--color-primary)'} />
                </Button>
                <Button variant="ghost" iconOnly size="sm" aria-pressed={!adviceHidden}
                  aria-label={t('koios.radar.title')} title={t('koios.radar.title')}
                  onClick={() => setAdviceHidden(!adviceHidden)}>
                  <Lightbulb size={14} color={adviceHidden ? 'var(--sidebar-muted)' : 'var(--color-primary)'} />
                </Button>
              </>
            )}

            {/* Model picker — only renders when there is more than one selectable model */}
            <KoiosModelPicker
              models={settings?.models?.selectable}
              options={settings?.models?.options}
              value={model ?? settings?.models?.active}
              onChange={setModel}
              t={t}
            />

            <div style={{ flex: 1 }} />

            {/* Voice dictation (SPEECH-1) — renders nothing without browser support */}
            <KoiosVoiceButton onText={appendVoiceText} t={t} />

            {/* Send */}
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || loading}
              aria-label={t('koios.taskPlaceholder')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- circular send control with a dynamic disabled-state fill/ink pair AND a hover-scale transform; none of Button's static variants model either
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: input.trim() && !loading ? 'var(--text)' : 'var(--border)',
                // Fill is the inverted text/bg pair (dark pill in light mode, light pill in
                // dark mode) — var(--bg) is guaranteed to contrast var(--text) by definition,
                // unlike the raw 'white' this replaced (unreadable at 1.09:1 in dark mode).
                color: input.trim() && !loading ? 'var(--bg)' : 'var(--text-muted)',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'background var(--motion-fast), transform 0.1s',
              }}
              onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.transform = 'scale(1.08)' }}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--sidebar-muted)', textAlign: 'center', marginTop: 7 }}>
          {t('koios.inputHint')}
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .km-koios-resize-handle:hover, .km-koios-resize-handle:focus-visible {
          background: ${tint('var(--color-primary)', TINT_BORDER)};
        }
      `}</style>
    </div>
  )
}
