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
import { Bot, AtSign, Paperclip, ArrowUp } from 'lucide-react'
import { useLocale } from '@/lib/datetime'
import { humanizeIsoDates } from '@/lib/localDate'
import { tint, TINT_BORDER } from '@/lib/tint'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useKoiosChat } from './koios/useKoiosChat'
import { useKoiosSettings } from './koios/useKoiosSettings'
import { useKoiosPanelWidth } from './koios/useKoiosPanelWidth'
import { useKoiosMentionCounts } from './koios/useKoiosMentionCounts'
import { useKoiosContextChips } from './koios/useKoiosContextChips'
import { useKoiosComposerKeys } from './koios/useKoiosComposerKeys'
import { addContextRef, removeContextRef } from './koios/contextRefs'
import { koiosMarkdownToHtml } from './koios/koiosMarkdown'
import SafeHtml from '@/components/ui/SafeHtml'
import KoiosSteps from './koios/KoiosSteps'
import KoiosUsage from './koios/KoiosUsage'
import KoiosModelPicker from './koios/KoiosModelPicker'
import KoiosMentionMenu from './koios/KoiosMentionMenu'
import KoiosContextChips from './koios/KoiosContextChips'
import type { KoiosContextChipRow } from './koios/KoiosContextChips'
import KoiosHeader from './koios/KoiosHeader'
import KoiosResizeHandle from './koios/KoiosResizeHandle'
import KoiosPendingActionCard from './koios/KoiosPendingActionCard'
import KoiosResultCards from './koios/KoiosResultCards'
import KoiosRadar from './koios/KoiosRadar'
import KoiosVoiceButton from './koios/KoiosVoiceButton'
import type { KoiosResultRef } from './koios/koiosTypes'
import type { KoiosChatMessage, KoiosContextRef, TFn } from '@/types/koios'

// gradient used for the assistant avatar + user bubble.
const GRADIENT = 'linear-gradient(135deg,var(--color-primary),var(--color-violet))'

// Resolve a message to its display text + whether it's a calm system notice
// (notices carry no steps/usage). Keeps the JSX below readable.
function resolveMessage(msg: KoiosChatMessage, t: TFn) {
  if (msg.kind === 'welcome')   return { text: t('koios.welcome'),       notice: false }
  if (msg.kind === 'error')     return { text: t('koios.errorReply'),    notice: true }
  if (msg.kind === 'forbidden') return { text: t('koios.forbidden'),     notice: true }
  // A known backend error code (credit exhausted, temporary outage) gets its own
  // translated notice instead of the generic "couldn't reach Koios" line.
  if (msg.kind === 'knownError') return { text: t(msg.errorKey ?? 'errorReply'), notice: true }
  if (msg.role === 'user')      return { text: msg.content,              notice: false }
  if (msg.stopReason === 'not_configured')
    return { text: msg.answer || t('koios.notConfigured'),               notice: true }
  return { text: msg.answer, notice: false }
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function KoiosMessage({ msg, isNew, t, locale }: { msg: KoiosChatMessage; isNew?: boolean; t: TFn; locale?: string }) {
  const isKoios = msg.role !== 'user'
  const { text, notice } = resolveMessage(msg, t)
  // Subtle tag under the bubble for a self-refusal or an unfinished (max_steps) run.
  const stopTag = isKoios && !notice && msg.stopReason === 'refusal' ? t('koios.stopRefused')
    : isKoios && !notice && msg.stopReason === 'max_steps' ? t('koios.stopMaxSteps') : null
  // Job 3 (dormant): flatten every step's `refs[]` into one deep-link card row.
  const resultRefs: KoiosResultRef[] = (msg.steps ?? []).flatMap((s) => s.refs ?? [])

  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isKoios ? 'row' : 'row-reverse',
      alignItems: 'flex-end', animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none' }}>
      {isKoios && (
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginBottom: 2,
          background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* GRADIENT embeds the tenant accent — the on-accent token, not a hardcoded white. */}
          <Bot size={13} color="var(--color-on-accent)" />
        </div>
      )}
      <div style={{ maxWidth: '84%', display: 'flex', flexDirection: 'column',
        alignItems: isKoios ? 'flex-start' : 'flex-end' }}>
        <div style={{
          padding: '9px 13px',
          borderRadius: isKoios ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          fontSize: 13, lineHeight: 1.6, whiteSpace: isKoios && !notice ? 'normal' : 'pre-wrap',
          background: isKoios ? 'var(--surface)' : GRADIENT,
          color:      isKoios ? (notice ? 'var(--text-muted)' : 'var(--text)') : 'var(--color-on-accent)',
          border:     isKoios ? '1px solid var(--border)' : 'none',
          // HUISSTIJL-1: colored glow tied to the gradient bubble background, none of card/float/modal — kept.
          boxShadow:  isKoios ? 'none' : '0 2px 10px rgba(99,102,241,0.35)',
        }}>
          {/* DATUM-1: rewrite any AI-composed ISO date to DD-MM-YYYY before markdown/DOMPurify; assistant replies render basic markdown (bold/lists) through SafeHtml, user text and notices stay plain. */}
          {isKoios && !notice ? <SafeHtml html={koiosMarkdownToHtml(humanizeIsoDates(text ?? ''))} /> : text}
        </div>
        {stopTag && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{stopTag}</div>}
        {/* Job 2 (dormant): a proposed write waiting for the user's confirm/cancel. */}
        {isKoios && !notice && msg.pendingAction && <KoiosPendingActionCard action={msg.pendingAction} />}
        {/* Job 3 (dormant): deep-link cards for any refs a read-tool step returned. */}
        {isKoios && !notice && resultRefs.length > 0 && <KoiosResultCards refs={resultRefs} />}
        {isKoios && !notice && <KoiosSteps steps={msg.steps} t={t} />}
        {isKoios && !notice && msg.stopReason !== 'not_configured' && (
          <KoiosUsage usage={msg.usage} model={msg.model} t={t} locale={locale} />
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bot size={13} color="var(--color-on-accent)" />
      </div>
      <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-violet)',
            display: 'block', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

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
          <KoiosRadar onNavigate={onNavigate} />
        ) : (
          messages.map((msg, i) => (
            <KoiosMessage key={i} msg={msg} isNew={i === messages.length - 1} t={t} locale={locale} />
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

            {/* Model picker — only renders when there is more than one selectable model */}
            <KoiosModelPicker
              models={settings?.models?.selectable}
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
