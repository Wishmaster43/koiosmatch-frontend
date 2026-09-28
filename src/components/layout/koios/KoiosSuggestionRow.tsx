/**
 * KoiosSuggestionRow — one compact line per Koios assistant suggestion
 * (KOIOS-SUGGEST-COMPACT-1, Danny 24-09: "the block must read short and
 * punchy"). Kind/task-type icon in its own colour · record chip (deep link) ·
 * a SHORT typed reason (never the server's Dutch prose) · every action as an
 * icon button so translating stays a matter of translating the action word,
 * not the whole sentence · the chat handoff. The staged/confirm leg (golf 3,
 * `KoiosSuggestionExec`) is UNCHANGED — moved here verbatim from KoiosAssistantBlock.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Phone, Mail, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import ActionMenu from '@/components/ui/ActionMenu'
import { Caption } from '@/components/ui/typography'
import LookupIcon from '@/components/ui/LookupIcon'
import { KoiosRefChip } from './KoiosResultCards'
import { useNavigation } from '@/context/NavigationContext'
import { pageForResultRef } from './koiosResultLinks'
import { useKoiosToolCapabilities, findToolCapability } from './useKoiosToolCapabilities'
import type { KoiosCapabilityTool } from './useKoiosToolCapabilities'
import { confirmPendingAction, cancelPendingAction, stagePendingAction } from './koiosApi'
import { extractApiError } from '@/lib/extractApiError'
import { KIND_META, toolIcon, reasonKey, reasonShortKey } from './koiosSuggestionMeta'
import { canonicalToolId } from './koiosToolIds'
import { ExecErrorNotice, ExecutedNotice, StagedPreview } from './KoiosSuggestionExec'
import RescheduleEditor from './RescheduleEditor'
import { useRun, useStageAndConfirm, useLandAfterExecute, previewLine, isIdRow } from './koiosSuggestionRunner'
import type { ExecState, StagedAction } from './koiosSuggestionRunner'
import type { KoiosAssistantAction, KoiosAssistantSuggestion } from './useKoiosAssistant'
import type { KoiosContextRef } from '@/types/koios'

export type AskKoios = (text: string, refs: KoiosContextRef[]) => void
type TFn = (key: string, opts?: Record<string, unknown>) => string
// A context ref known to carry contact data (the `.filter(r => r.contact)` narrowing
// TS can't infer through — see `personRefs` below).
type KoiosContextRefWithContact = KoiosContextRef & { contact: NonNullable<KoiosContextRef['contact']> }
// One person channel icon (call/mail), rendered inline or folded into the overflow menu.
type ChannelIcon = { key: string; label: string; href: string; Icon: LucideIcon }

// The refs the chat can use as context: real records, never the parked-action handle.
const contextRefsOf = (s: KoiosAssistantSuggestion) => s.refs.filter(r => r.type !== 'pending_action')
// The row's choices: KOIOS-PANEL-2 `actions[]` (first = primary, rest = menu), else the
// single `action` of the older envelope.
const choicesOf = (s: KoiosAssistantSuggestion): KoiosAssistantAction[] => s.actions?.length ? s.actions : s.action ? [s.action] : []
// The tool's own args under either key the envelope may use.
const argsOf = (a: KoiosAssistantAction) => a.input ?? a.args ?? {}

// The chat handoff button — the ONE face on every row (icon-only, ghost), never a
// filled button on a row that happens to have no executable action.
function AskKoiosButton({ suggestion, onAskKoios, t }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; t: TFn }) {
  if (!onAskKoios) return null
  const label = t('koios.assistant.askKoios')
  return (
    <Button size="sm" variant="ghost" iconOnly aria-label={label} title={label}
      onClick={() => onAskKoios(t(`koios.assistant.askIntentByKind.${suggestion.kind}`, { title: suggestion.title, body: suggestion.body, defaultValue: t('koios.assistant.askIntent', { title: suggestion.title, body: suggestion.body }) }), contextRefsOf(suggestion))}>
      <MessageSquare size={13} />
    </Button>
  )
}

// The short typed reason (KOIOS-SUGGEST-COMPACT-1): a plural count from `params`
// when the backend sends it, else the short kind fallback — NEVER the server's
// Dutch `body`, which stays only as the row's title tooltip.
function reasonOf(suggestion: KoiosAssistantSuggestion, t: TFn): string {
  const p = suggestion.params
  if (p) {
    // A pending_action's short verb: the registry tool's own word (canonical
    // English id, so an old Dutch id still resolves), else the generic "Run".
    if ('tool' in p) return t(`koios.tools.${canonicalToolId(p.tool)}`, { defaultValue: t('koios.tools.unknown') })
    if ('days_overdue' in p) return t(reasonKey(suggestion.kind), { count: p.days_overdue })
    if ('days_since_contact' in p) return p.days_since_contact == null ? t(reasonShortKey(suggestion.kind)) : t(reasonKey(suggestion.kind), { count: p.days_since_contact })
    if ('days_to_close' in p) return t(reasonKey(suggestion.kind), { count: p.days_to_close })
    if ('days_open' in p) return t(reasonKey(suggestion.kind), { count: p.days_open })
  }
  return t(reasonShortKey(suggestion.kind))
}

// One action's accessible name (CMBE addendum 28-09): the action's own word
// (`koios.assistant.actions.<key>`), then the server's `tool_label_key` — and
// (KOIOS-EN-1 phase B) when THAT key itself is missing (a stale Dutch id the
// locale no longer carries), `koios.tools.<canonicalToolId(tool)>` instead —
// then the server's NL label, never a bare "Execute".
function toolLabel(a: KoiosAssistantAction, t: TFn): string {
  const nlFallback = a.label || t('koios.tools.unknown')
  const MISSING = '__koios_tool_label_missing__'
  let toolFallback = nlFallback
  if (a.tool_label_key) {
    const resolved = t(a.tool_label_key, { defaultValue: MISSING })
    toolFallback = resolved === MISSING ? t(`koios.tools.${canonicalToolId(a.tool)}`, { defaultValue: nlFallback }) : resolved
  }
  return a.label_key ? t(a.label_key, { defaultValue: toolFallback }) : toolFallback
}

// One suggestion row: kind/task-type icon (drawn INTO the record chip, never a second
// glyph beside it) · record chip · short reason · icon actions · chat.
export default function KoiosSuggestionRow({ suggestion, onAskKoios, onDone }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; onDone?: (result: 'executed' | 'cancelled') => void }) {
  const { t } = useTranslation('common')
  const meta = KIND_META[suggestion.kind] ?? KIND_META.pending_action
  const Icon = meta.Icon
  const primaryRef = contextRefsOf(suggestion)[0]
  const [exec, setExec] = useState<ExecState>({ phase: 'idle' })
  // RESCHEDULE-EDIT-1: the one-step stage→confirm path for the reschedule editor's
  // edited input, kept at the row level so the same wiring serves any future
  // "adjust before it runs" action, not only the button cluster in SuggestionActions.
  // Shares `landAfterExecute` with SuggestionActions' own `run` (verifier fix) so
  // this path also lands on the server's navigate hint / the tool's follow-up tab.
  const landAfterExecute = useLandAfterExecute(suggestion)
  const run = useRun(setExec, landAfterExecute)
  const stageAndConfirm = useStageAndConfirm(setExec, run)
  // Task type carries its OWN icon+colour from the tenant lookup (Danny 24-09).
  const taskType = suggestion.params && 'task_type' in suggestion.params ? suggestion.params.task_type : null
  const rowIcon = taskType?.icon
    ? <LookupIcon icon={taskType.icon} size={13} color={taskType.color ?? meta.color} />
    : <Icon size={13} color={taskType?.color ?? meta.color} />
  // Report the terminal outcome to the block EXACTLY once (KOIOS-SUGGEST-COMPACT-2,
  // Danny 28-09: "Create taak annuleren en blijft staan, geen auto refresh") — the block
  // uses this to drop the row and toast, independent of which internal path (pending-action
  // confirm/cancel or a staged descriptor) reached the terminal state. `onDone` is read via
  // a ref updated in its own mount-effect (REFS-IN-EFFECTS-1) so the reporting effect below
  // never needs the caller's fresh closure in its own dependency list.
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone })
  const reportedRef = useRef(false)
  useEffect(() => {
    if ((exec.phase === 'executed' || exec.phase === 'cancelled') && !reportedRef.current) {
      reportedRef.current = true
      onDoneRef.current?.(exec.phase)
    }
  }, [exec.phase])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {primaryRef
          ? <span style={{ flexShrink: 0 }}><KoiosRefChip item={primaryRef} icon={rowIcon} /></span>
          : (
            <>
              <span style={{ display: 'flex', flexShrink: 0, color: taskType?.color ?? meta.color }}>{rowIcon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{suggestion.title}</span>
            </>
          )}
        {/* One line, never the server's raw prose — the full body stays the tooltip. */}
        <Caption title={suggestion.body} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reasonOf(suggestion, t)}
        </Caption>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <SuggestionActions suggestion={suggestion} onAskKoios={onAskKoios} exec={exec} setExec={setExec} />
        </span>
      </div>
      {choicesOf(suggestion).length > 0 && (exec.phase === 'staged' || (exec.phase === 'submitting' && exec.staged)) && (
        <StagedPreview exec={exec} setExec={setExec} />
      )}
      {exec.phase === 'editing' && exec.editingAction && (
        <RescheduleEditor
          action={exec.editingAction}
          onConfirm={(input) => { void stageAndConfirm(stagePendingAction, confirmPendingAction, exec.editingAction!.tool, input) }}
          onCancel={() => setExec({ phase: 'idle' })}
        />
      )}
    </div>
  )
}

// The action cluster on one row — every action an icon button (Danny: no "Execute"
// word), plus the person's channels for any kind carrying a contactable ref. The row
// itself (not this component) reports the terminal outcome up to the block, via the
// shared `exec` state — see KoiosSuggestionRow's own effect.
function SuggestionActions({ suggestion, onAskKoios, exec, setExec }: {
  suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; exec: ExecState; setExec: (s: ExecState) => void
}) {
  const { t } = useTranslation('common')
  const { openEntity } = useNavigation()
  const { tools: capabilityTools, isLoading: capsLoading } = useKoiosToolCapabilities()
  const choices = choicesOf(suggestion)
  const primary: KoiosAssistantAction | undefined = choices[0]
  const capability: KoiosCapabilityTool | undefined = findToolCapability(capabilityTools, primary?.tool)
  const previewTitle = (a: KoiosAssistantAction) => (a.preview ?? []).filter(row => !isIdRow(row)).map(previewLine).join(' · ')
  const toolAllowed = (tool: string) => {
    const c = findToolCapability(capabilityTools, tool)
    return c?.enabled_for_tenant !== false && c?.enabled_for_me !== false
  }
  // Contact channels for EVERY person ref on the row (KOIOS-SUGGEST-COMPACT-2, Danny
  // 28-09: "belafspraak/intake plannen mis ik snelle informatie icons") — not only the
  // first. CMBE addendum 28-09: candidate refs and the opportunity's contact-person ref
  // both carry `contact.{phone,mobile,email,whatsapp}`.
  const personRefs = contextRefsOf(suggestion).filter(r => r.contact && (r.contact.mobile || r.contact.phone || r.contact.email))
  const channelIconsFor = (ref: KoiosContextRefWithContact): ChannelIcon[] => {
    const c = ref.contact
    const items: ChannelIcon[] = []
    if (c.mobile || c.phone) items.push({ key: `call:${ref.id}`, label: t('koios.assistant.callPerson', { name: ref.label }), href: `tel:${c.mobile || c.phone}`, Icon: Phone })
    if (c.email) items.push({ key: `mail:${ref.id}`, label: t('koios.assistant.mailPerson', { name: ref.label }), href: `mailto:${c.email}`, Icon: Mail })
    return items
  }
  const firstPersonChannels = personRefs[0] ? channelIconsFor(personRefs[0] as KoiosContextRefWithContact) : []
  const restPersonChannels = personRefs.slice(1).flatMap(r => channelIconsFor(r as KoiosContextRefWithContact))
  // A candidate ref always gets the conversation icon — no more `contact.whatsapp`
  // gate (Danny 28-09: "Bij kandidaat mis ik conversatie starten") — UNLESS a
  // send_whatsapp action is already offered, so the two never sit side by side.
  const candidateRef = contextRefsOf(suggestion).find(r => r.type === 'candidate')
  const hasWhatsAppAction = choices.some(a => a.key === 'send_whatsapp' || canonicalToolId(a.tool) === 'send_whatsapp')
  const candidatePage = candidateRef ? pageForResultRef('candidate') : null
  const showConversationIcon = Boolean(candidateRef && candidatePage && !hasWhatsAppAction)
  // A tool switched off for the organisation or for this user is simply not offered
  // (Danny 10-09: a chip beside a dead button adds nothing); the row keeps its other actions.
  const primaryOffered = Boolean(primary) && capability?.enabled_for_tenant !== false && capability?.enabled_for_me !== false
  // After an executed action: the response's own landing spot, else the tool's follow-up
  // on the row's record (a search opens the vacancy's candidate-search tab) — shared with
  // the row-level reschedule path via `useLandAfterExecute` (verifier fix, KOIOS-ROW-2).
  const landAfterExecute = useLandAfterExecute(suggestion)
  const run = useRun(setExec, landAfterExecute)
  const pendingRef = suggestion.kind === 'pending_action'
    ? suggestion.refs.find(r => r.type === 'pending_action')
    : undefined

  // Golf 3 (CMBE 03f2630c): stage a descriptor's {tool,input} — parks only,
  // nothing executes; the preview + confirm step follow under the same row.
  const stage = async (chosen: KoiosAssistantAction | undefined = primary) => {
    if (!chosen) return
    setExec({ phase: 'staging' })
    try {
      const body = await stagePendingAction(chosen.tool, argsOf(chosen))
      if (body?.status === 'staged' && body?.action?.id) {
        const staged = body.action as StagedAction
        const chosenCapability = findToolCapability(capabilityTools, chosen.tool)
        if (chosenCapability && !chosenCapability.confirm_required) { await run(staged.id, confirmPendingAction, 'executed', staged.title); return }
        setExec({ phase: 'staged', staged })
      } else setExec({ phase: 'error', message: body?.message ?? t('koios.pendingAction.error') })
    } catch (err) {
      setExec({ phase: 'error', message: extractApiError(err, t('koios.pendingAction.error')) })
    }
  }
  // RESCHEDULE-EDIT-1: an action whose input carries a `due_date` opens the inline
  // editor instead of staging straight away — the user picks the new date first
  // (CLAUDE.md §0B: "a way to adjust it before running"), never the raw proposal.
  const isRescheduleInput = (a: KoiosAssistantAction) => typeof argsOf(a).due_date === 'string'
  const runAction = (a: KoiosAssistantAction) => {
    if (isRescheduleInput(a)) setExec({ phase: 'editing', editingAction: a })
    else void stage(a)
  }

  if (exec.phase === 'executed') return <ExecutedNotice created={exec.created} t={t} />
  if (exec.phase === 'cancelled') return <span role="status"><Caption>{t('koios.pendingAction.cancelled')}</Caption></span>
  if (exec.phase === 'error') return <ExecErrorNotice message={exec.message} budget={exec.budget} t={t} />
  if (exec.phase === 'editing') return null
  if (pendingRef) {
    return (
      <>
        <Button size="sm" onClick={() => run(pendingRef.id, confirmPendingAction, 'executed', suggestion.title)} disabled={exec.phase === 'submitting'}>
          {exec.phase === 'submitting' ? <Spinner size={12} /> : null} {t('koios.pendingAction.confirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run(pendingRef.id, cancelPendingAction, 'cancelled')} disabled={exec.phase === 'submitting'}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </>
    )
  }
  if (primary && (exec.phase === 'staged' || exec.phase === 'submitting')) return null
  const extra = choices.slice(1).filter(a => toolAllowed(a.tool))
  const iconTotal = firstPersonChannels.length + restPersonChannels.length + (showConversationIcon ? 1 : 0) + (primaryOffered ? 1 : 0) + extra.length + 1 // +1 chat icon
  // Cap at six inline icons (Danny: "duidelijke icons"). The FIRST person's channels
  // always stay inline; a second-or-later person's channels fold into ⋯ once the row
  // passes six. Extra actions are judged WITHOUT those folded channels, so they only
  // fold when the row overflows on its own, and a single extra action never folds
  // (the ⋯ trigger takes the same slot, so hiding a lone action behind it saves no
  // width and just adds a click — Danny: "taak overtijd moet actie bij staan").
  const showRestInline = iconTotal <= 6
  const showExtraInline = (iconTotal - restPersonChannels.length) <= 6 || extra.length === 1
  const overflowActionItems = extra.map(a => ({ key: a.key ?? a.tool, label: toolLabel(a, t), onSelect: () => runAction(a) }))
  const overflowChannelItems = restPersonChannels.map(c => ({ key: c.key, label: c.label, onSelect: () => { window.location.href = c.href } }))
  return (
    <>
      {firstPersonChannels.map(c => (
        <Button key={c.key} size="sm" variant="ghost" iconOnly href={c.href}
          aria-label={c.label} title={c.label}><c.Icon size={13} /></Button>
      ))}
      {restPersonChannels.length > 0 && showRestInline && restPersonChannels.map(c => (
        <Button key={c.key} size="sm" variant="ghost" iconOnly href={c.href}
          aria-label={c.label} title={c.label}><c.Icon size={13} /></Button>
      ))}
      {showConversationIcon && candidateRef && candidatePage && (
        <Button size="sm" variant="ghost" iconOnly
          // CONVERSATION-START-1: land on Conversations with the start-conversation
          // modal already open — a bare 'communication' target lands on Notes.
          onClick={() => openEntity(candidatePage, candidateRef.id, 'communication:conversations:start')}
          aria-label={t('koios.assistant.messagePerson', { name: candidateRef.label })} title={t('koios.assistant.messagePerson', { name: candidateRef.label })}>
          <MessageCircle size={13} />
        </Button>
      )}
      {primary && primaryOffered && (
        <Button size="sm" variant="secondary" iconOnly onClick={() => runAction(primary)} disabled={exec.phase === 'staging' || capsLoading}
          aria-label={toolLabel(primary, t)} title={previewTitle(primary) || toolLabel(primary, t)}>
          {exec.phase === 'staging' ? <Spinner size={12} /> : (() => { const Ico = toolIcon(primary); return <Ico size={13} /> })()}
        </Button>
      )}
      {extra.length > 0 && showExtraInline && extra.map(a => {
        const Ico = toolIcon(a)
        return (
          <Button key={a.key ?? a.tool} size="sm" variant="ghost" iconOnly onClick={() => runAction(a)}
            aria-label={toolLabel(a, t)} title={previewTitle(a) || toolLabel(a, t)}><Ico size={13} /></Button>
        )
      })}
      {((!showExtraInline && extra.length > 0) || (!showRestInline && restPersonChannels.length > 0)) && (
        <ActionMenu iconOnly ariaLabel={t('koios.assistant.moreActions')} align="right" menuWidth={220}
          items={[...(showExtraInline ? [] : overflowActionItems), ...(showRestInline ? [] : overflowChannelItems)]} />
      )}
      <AskKoiosButton suggestion={suggestion} onAskKoios={onAskKoios} t={t} />
    </>
  )
}
