/**
 * KoiosSuggestionRow — one compact line per Koios assistant suggestion
 * (KOIOS-SUGGEST-COMPACT-1, Danny 24-09: "the block must read short and
 * punchy"). Kind/task-type icon in its own colour · record chip (deep link) ·
 * a SHORT typed reason (never the server's Dutch prose) · every action as an
 * icon button so translating stays a matter of translating the action word,
 * not the whole sentence · the chat handoff. The staged/confirm leg (golf 3,
 * `KoiosSuggestionExec`) is UNCHANGED — moved here verbatim from KoiosAssistantBlock.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Phone, Mail, MessageCircle } from 'lucide-react'
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
import { KIND_META, TOOL_FOLLOW_UP, toolIcon, reasonKey, reasonShortKey } from './koiosSuggestionMeta'
import { ExecErrorNotice, ExecutedNotice, StagedPreview } from './KoiosSuggestionExec'
import { useRun, previewLine, isIdRow } from './koiosSuggestionRunner'
import type { ExecState, StagedAction, NavigateHint } from './koiosSuggestionRunner'
import type { KoiosAssistantAction, KoiosAssistantSuggestion } from './useKoiosAssistant'
import type { KoiosContextRef } from '@/types/koios'

export type AskKoios = (text: string, refs: KoiosContextRef[]) => void
type TFn = (key: string, opts?: Record<string, unknown>) => string

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
    // A pending_action's short verb: the registry tool's own word, else the generic "Run".
    if ('tool' in p) return t(`koios.tools.${p.tool}`, { defaultValue: t('koios.tools.unknown') })
    if ('days_overdue' in p) return t(reasonKey(suggestion.kind), { count: p.days_overdue })
    if ('days_since_contact' in p) return p.days_since_contact == null ? t(reasonShortKey(suggestion.kind)) : t(reasonKey(suggestion.kind), { count: p.days_since_contact })
    if ('days_to_close' in p) return t(reasonKey(suggestion.kind), { count: p.days_to_close })
    if ('days_open' in p) return t(reasonKey(suggestion.kind), { count: p.days_open })
  }
  return t(reasonShortKey(suggestion.kind))
}

// One action's accessible name (CMBE addendum 28-09): the action's own word
// (`koios.assistant.actions.<key>`), then the registry tool's word
// (`koios.tools.<tool>`), then the server's NL label — never a bare "Execute".
function toolLabel(a: KoiosAssistantAction, t: TFn): string {
  const nlFallback = a.label || t('koios.tools.unknown')
  const toolFallback = a.tool_label_key ? t(a.tool_label_key, { defaultValue: nlFallback }) : nlFallback
  return a.label_key ? t(a.label_key, { defaultValue: toolFallback }) : toolFallback
}

// One suggestion row: kind/task-type icon · record chip · short reason · icon actions · chat.
export default function KoiosSuggestionRow({ suggestion, onAskKoios, onDone }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; onDone?: () => void }) {
  const { t } = useTranslation('common')
  const meta = KIND_META[suggestion.kind] ?? KIND_META.pending_action
  const Icon = meta.Icon
  const primaryRef = contextRefsOf(suggestion)[0]
  const [exec, setExec] = useState<ExecState>({ phase: 'idle' })
  // Task type carries its OWN icon+colour from the tenant lookup (Danny 24-09).
  const taskType = suggestion.params && 'task_type' in suggestion.params ? suggestion.params.task_type : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 18, color: taskType?.color ?? meta.color }}>
          {taskType?.icon ? <LookupIcon icon={taskType.icon} size={13} color={taskType.color ?? undefined} /> : <Icon size={13} />}
        </span>
        {primaryRef
          ? <span style={{ flexShrink: 0 }}><KoiosRefChip item={primaryRef} /></span>
          : <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{suggestion.title}</span>}
        {/* One line, never the server's raw prose — the full body stays the tooltip. */}
        <Caption title={suggestion.body} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reasonOf(suggestion, t)}
        </Caption>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <SuggestionActions suggestion={suggestion} onAskKoios={onAskKoios} exec={exec} setExec={setExec} onDone={onDone} />
        </span>
      </div>
      {choicesOf(suggestion).length > 0 && (exec.phase === 'staged' || (exec.phase === 'submitting' && exec.staged)) && (
        <StagedPreview exec={exec} setExec={setExec} onDone={onDone} />
      )}
    </div>
  )
}

// The action cluster on one row — every action an icon button (Danny: no "Execute"
// word), plus the person's channels for any kind carrying a contactable ref.
function SuggestionActions({ suggestion, onAskKoios, exec, setExec, onDone }: {
  suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; exec: ExecState; setExec: (s: ExecState) => void; onDone?: () => void
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
  // Contact channels for ANY kind carrying a person ref — generalised (was
  // candidate_no_contact only). CMBE addendum 28-09: candidate refs and the
  // opportunity's contact-person ref both carry `contact.{phone,mobile,email,whatsapp}`.
  const personRef = contextRefsOf(suggestion).find(r => r.type === 'candidate' || r.type === 'contact')
  const contact = personRef?.contact
  const personPage = personRef ? pageForResultRef(personRef.type) : null
  // A send_whatsapp ACTION (stages through the tool) already renders its own icon —
  // the standalone conversation icon only fills in when no such action is offered.
  const hasWhatsAppAction = choices.some(a => a.key === 'send_whatsapp' || a.tool === 'stuur_whatsapp')
  const showStandaloneWhatsApp = Boolean(personRef && personPage && contact?.whatsapp === true && !hasWhatsAppAction)
  // A tool switched off for the organisation or for this user is simply not offered
  // (Danny 10-09: a chip beside a dead button adds nothing); the row keeps its other actions.
  const primaryOffered = Boolean(primary) && capability?.enabled_for_tenant !== false && capability?.enabled_for_me !== false
  // After an executed action: the response's own landing spot, else the tool's follow-up
  // on the row's record (a search opens the vacancy's candidate-search tab).
  const landAfterExecute = (navigate?: NavigateHint) => {
    const hint = navigate?.type && navigate.id ? navigate : undefined
    const lead = choicesOf(suggestion)[0]
    const follow = lead ? TOOL_FOLLOW_UP[lead.tool] : undefined
    const ref = hint ? { type: hint.type!, id: hint.id!, tab: hint.tab } : follow ? (() => {
      const r = suggestion.refs.find(x => x.type === follow.refType)
      return r ? { type: r.type, id: r.id, tab: follow.tab } : undefined
    })() : undefined
    const page = ref ? pageForResultRef(ref.type) : null
    if (ref && page) openEntity(page, ref.id, ref.tab)
    onDone?.()
  }
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

  if (exec.phase === 'executed') return <ExecutedNotice created={exec.created} t={t} />
  if (exec.phase === 'cancelled') return <span role="status"><Caption>{t('koios.pendingAction.cancelled')}</Caption></span>
  if (exec.phase === 'error') return <ExecErrorNotice message={exec.message} budget={exec.budget} t={t} />
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
  const contactIconCount = (contact?.mobile || contact?.phone ? 1 : 0) + (contact?.email ? 1 : 0) + (showStandaloneWhatsApp ? 1 : 0)
  const iconTotal = contactIconCount + (primaryOffered ? 1 : 0) + extra.length + 1 // +1 chat icon
  // A single extra action always stays inline: the ⋯ trigger takes the same icon
  // slot, so hiding a lone action behind it saves no width and just adds a click
  // (Danny: "taak overtijd moet actie bij staan").
  const showExtraInline = iconTotal <= 4 || extra.length === 1
  return (
    <>
      {contact && (contact.mobile || contact.phone) && (
        <Button size="sm" variant="ghost" iconOnly href={`tel:${contact.mobile || contact.phone}`}
          aria-label={t('koios.assistant.call')} title={t('koios.assistant.call')}><Phone size={13} /></Button>
      )}
      {contact?.email && (
        <Button size="sm" variant="ghost" iconOnly href={`mailto:${contact.email}`}
          aria-label={t('koios.assistant.email')} title={t('koios.assistant.email')}><Mail size={13} /></Button>
      )}
      {showStandaloneWhatsApp && personRef && personPage && (
        <Button size="sm" variant="ghost" iconOnly onClick={() => openEntity(personPage, personRef.id, 'communication')}
          aria-label={t('koios.assistant.message')} title={t('koios.assistant.message')}><MessageCircle size={13} /></Button>
      )}
      {primary && primaryOffered && (
        <Button size="sm" variant="secondary" iconOnly onClick={() => stage(primary)} disabled={exec.phase === 'staging' || capsLoading}
          aria-label={toolLabel(primary, t)} title={previewTitle(primary) || toolLabel(primary, t)}>
          {exec.phase === 'staging' ? <Spinner size={12} /> : (() => { const Ico = toolIcon(primary); return <Ico size={13} /> })()}
        </Button>
      )}
      {extra.length > 0 && showExtraInline && extra.map(a => {
        const Ico = toolIcon(a)
        return (
          <Button key={a.key ?? a.tool} size="sm" variant="ghost" iconOnly onClick={() => { void stage(a) }}
            aria-label={toolLabel(a, t)} title={previewTitle(a) || toolLabel(a, t)}><Ico size={13} /></Button>
        )
      })}
      {extra.length > 0 && !showExtraInline && (
        <ActionMenu iconOnly ariaLabel={t('koios.assistant.moreActions')} align="right" menuWidth={220}
          items={extra.map(a => ({ key: a.key ?? a.tool, label: toolLabel(a, t), onSelect: () => { void stage(a) } }))} />
      )}
      <AskKoiosButton suggestion={suggestion} onAskKoios={onAskKoios} t={t} />
    </>
  )
}
