/**
 * ConfigPanel — the right side panel that configures the selected module: its
 * header (icon/label/category + delete), the settings tab (schema fields via
 * FieldInput) and the execution-output tab. For the AI agent module it also
 * renders the Standard/Advanced/Test/Output tabs. Extracted from WorkflowCanvasEditor.
 */
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Zap, Trash2, Play } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { SectionTitle, Caption, BodyText } from '@/components/ui/typography'
import { requiredMark } from '@/components/forms/fields'
import Button from '@/components/ui/Button'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { MODULE_META, MODULE_SCHEMAS } from '@/modules/index'
import { FieldInput } from './fields'
import { categorySlug, fieldHint, fieldLabel } from './moduleI18n'
import { useModuleCatalog } from './useModuleCatalog'
import AgentTestPanel from './AgentTestPanel'
import OutputTree from './OutputTree'
import FanoutSummary, { type WaFanout } from './FanoutSummary'
import type { FlowNode, WorkflowField, WorkflowVarGroup } from '@/types/workflow'

// WEBHOOK-LOG-FE-2: lazy, not a static import — WebhookRequestsPanel pulls in
// @/lib/datetime, whose i18n import has a real-instance initialising side
// effect (BARREL-DATETIME-LES, §2) that would leak into every ConfigPanel test
// suite even for non-webhook nodes. Loaded only when this step's Verzoeken tab
// actually renders.
const WebhookRequestsLog = lazy(() => import('@/components/webhooks/WebhookRequestsPanel').then(m => ({ default: m.WebhookRequestsLog })))

// ExecutionOutputPane — the execution tab's empty/output block, shared by the agent
// and non-agent branches below: no run yet -> a calm placeholder; a run -> the
// fanout summary (when present), any extra notices the caller supplies as children
// (the non-agent branch's WhatsApp-queued/item-count captions), then the output
// tree. `noOutputLabel` is resolved by the caller's own t() (§5).
function ExecutionOutputPane({ output, fanout, noOutputLabel, children }: {
  output: unknown
  fanout?: WaFanout
  noOutputLabel: string
  children?: ReactNode
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {!output
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
            <Play size={24} color="var(--border)" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{noOutputLabel}</p>
          </div>
        : <div style={{ padding: 12 }}>
            {fanout && <FanoutSummary fanout={fanout} />}
            {children}
            <OutputTree data={output} />
          </div>}
    </div>
  )
}

// The workflow editor's right-side module configuration panel.
export default function ConfigPanel({ node, onUpdate, onDelete, onTabChange, variables = [] }: {
  node: FlowNode | null
  onUpdate: (nodeId: string, key: string, val: unknown) => void
  onDelete: (nodeId: string) => void
  onTabChange?: (tab: string) => void
  variables?: WorkflowVarGroup[]
}) {
  const { t } = useTranslation('workflows')
  // INTERVIEW-WORKFLOW-1 CMBE delta: the per-type instruction_output_fields
  // allow-list for ai_agent's instruction_list field (server-served, never
  // hardcoded) — the session-cached catalog is safe to re-fetch here since
  // useModuleCatalog shares one in-flight promise across every caller.
  const { catalog } = useModuleCatalog()
  const isAgent = node?.data.type === 'ai_agent'
  const isWebhookTrigger = node?.data.type === 'webhook'
  const [activeTab, setActiveTab] = useState(() => isAgent ? 'general' : 'settings')
  // WEBHOOK-LOG-FE-2: the "Verzoeken" tab needs the picked webhook's NAME (the
  // config only holds its id) — same /webhooks list the webhook_select field
  // reads (WebhookSelectField), fetched independently here for the same reason
  // that field fetches its own copy: no shared list cache exists yet.
  const [webhooks, setWebhooks] = useState<Array<{ id?: string | number; name?: string }>>([])
  useEffect(() => {
    if (!isWebhookTrigger) return
    let alive = true
    api.get('/webhooks')
      .then(r => { if (alive) setWebhooks(unwrapList<{ id?: string | number; name?: string }>(r).rows) })
      .catch(() => {})
    return () => { alive = false }
  }, [isWebhookTrigger])

  // Widen panel for ai_agent by emitting sentinel; narrow for all other modules.
  // Stable identity (useCallback) so effects that call it can list it as a dep.
  const switchTab = useCallback((id: string) => {
    setActiveTab(id)
    onTabChange?.(isAgent ? '__wide__' : id)
  }, [isAgent, onTabChange])

  // Reset to correct first tab when node changes
  useEffect(() => {
    const first = node?.data.type === 'ai_agent' ? 'general' : 'settings'
    setActiveTab(first)
    onTabChange?.(node?.data.type === 'ai_agent' ? '__wide__' : first)
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 02-09: the translations tab can vanish from under the user (e.g. flipping
  // whatsapp_send's format from session to template) — fall back honestly to
  // Settings rather than leaving the tab bar showing an emptied-out pane. Hooks
  // must stay unconditional, so this lives above the `!node` early return —
  // it recomputes the field's own showIf inline rather than calling
  // `fieldsForTab` (defined further below, after that return).
  const nodeSchema = node ? (MODULE_SCHEMAS[node.data.type ?? ''] || []) : []
  const nodeConfig = node?.data.config as Record<string, unknown> | undefined
  const translationsFieldCount = nodeSchema.filter(field => {
    const f = field as WorkflowField & { tab?: string }
    if (f.tab !== 'translations') return false
    const showIf = field.showIf as { key: string; value: unknown } | undefined
    if (!showIf) return true
    const ctrl = nodeSchema.find(s => s.key === showIf.key)
    const cur  = nodeConfig?.[showIf.key] ?? ctrl?.default
    const want = showIf.value
    return Array.isArray(want) ? want.includes(cur) : cur === want
  }).length
  useEffect(() => {
    if (!isAgent && activeTab === 'translations' && translationsFieldCount === 0) {
      switchTab('settings')
    }
  }, [isAgent, activeTab, translationsFieldCount, switchTab])

  if (!node) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={20} color="var(--border)" />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{t('config.emptyHint')}</p>
      </div>
    )
  }
  const type   = node.data.type ?? ''
  const meta   = MODULE_META[type]
  const schema = MODULE_SCHEMAS[type] || []
  const Icon   = meta?.Icon as unknown as LucideIcon | undefined
  const output = node.data.output
  const config = node.data.config as Record<string, unknown> | undefined
  // ai_agent's instruction-list output_field allow-list, when the backend serves
  // one for this step's module type; undefined/empty means the InstructionListField
  // renders no output-field control at all (no fake affordance, §3).
  const instructionOutputFields = catalog[type]?.instructionOutputFields
  // agent_id was renamed from the name-valued `agent` (CMBE delta, 2026-08-30):
  // a step saved before the rename still carries only `config.agent` — fall back
  // to it for one release so an already-configured step does not read as empty.
  // The engine (AiAgentModule.php) still resolves the agent by the legacy `agent`
  // NAME today, not by `agent_id` — LookupSelectField dual-writes both keys on
  // pick for exactly that reason (see ai_agent.ts docblock).
  const fieldValue = (key: string) => (key === 'agent_id' ? (config?.agent_id ?? config?.agent) : config?.[key])
  // WhatsApp fanout summary (R3a/CMBE 2026-07-09): present only when this step's
  // output embeds `whatsapp_fanout` — a whatsapp_send step that fanned out into a
  // WABA batch (see the Wachtrij tab on the WhatsApp page for the live batch).
  const fanout = (output && typeof output === 'object' && !Array.isArray(output)
    ? (output as Record<string, unknown>).whatsapp_fanout
    : undefined) as WaFanout | undefined
  // K-193 fase 2b: a whatsapp_send step over wa_web reports how many messages it
  // handed to the WhatsApp Web queue (whatsapp_queued). The backend mirrors this
  // same key onto the WABA fan-out output too (WhatsAppFanoutProgress), so this
  // line must be gated on the step actually being a wa_web send, never on the
  // key's mere presence, or a Cloud-API batch would falsely read "WhatsApp Web".
  const waQueuedRaw = (output && typeof output === 'object' && !Array.isArray(output)
    ? (output as Record<string, unknown>).whatsapp_queued
    : undefined) as number | undefined
  const waQueued = type === 'whatsapp_send' && config?.channel === 'wa_web' && (waQueuedRaw ?? 0) > 0
    ? waQueuedRaw
    : undefined

  // K-193 fase 2b: whatsapp_send's channel picker auto-sets message_type to the
  // ONLY format WhatsApp Web can send (session/free-text) — never silent: the
  // Caption notice below message_type explains why. Only fires on the ACTUAL
  // channel field of whatsapp_send, and only when message_type is not already
  // 'session', so an explicit prior choice is never overwritten redundantly.
  const handleFieldChange = (key: string, val: unknown) => {
    onUpdate(node.id, key, val)
    if (type === 'whatsapp_send' && key === 'channel' && val === 'wa_web' && config?.message_type !== 'session') {
      onUpdate(node.id, 'message_type', 'session')
    }
  }

  // Helper: filter schema fields by tab and showIf — strict match, not merely
  // "same tab or untagged" (a bug that leaked every untagged whatsapp_send/
  // email_send field onto the new Vertalingen tab as a full duplicate form).
  const fieldsForTab = (tab: string) => schema.filter(field => {
    const f = field as WorkflowField & { tab?: string }
    if (f.tab !== tab) return false
    const showIf = field.showIf as { key: string; value: unknown } | undefined
    if (!showIf) return true
    const ctrl = schema.find(s => s.key === showIf.key)
    const cur  = config?.[showIf.key] ?? ctrl?.default
    const want = showIf.value
    return Array.isArray(want) ? want.includes(cur) : cur === want
  })

  // Per-field flags both field loops below read: the K-193 required mark, the
  // empty check and the registry validator's message (WA-RECIPIENT-FIELD-1).
  const fieldFlags = (field: WorkflowField) => {
    const value = fieldValue(field.key)
    return { isRequired: !!field.required, isEmpty: value == null || value === '', invalidMsg: field.validate?.(value) ?? null }
  }

  // Shared field list renderer
  const renderFields = (fields: typeof schema) => (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {fields.map(field => {
        const { isRequired, isEmpty, invalidMsg } = fieldFlags(field as WorkflowField)
        // 02-09: the translations tab IS the field's label — no repeated
        // "VERTALINGEN" caption above the content (MODULE-FACE-BEVRIES).
        const isTranslations = field.type === 'translations'
        return (
          <div key={field.key}>
            {/* REQUIRED-A11Y-1: shared house asterisk (fields.tsx). This <label> has
                no htmlFor and FieldInput takes no id, so aria-required cannot be
                wired here — that needs FieldInput itself (out of this file's scope). */}
            {!isTranslations && (
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                {fieldLabel(t, field.label as string | undefined)}
                {isRequired && requiredMark}
              </label>
            )}
            <FieldInput field={field as WorkflowField} value={fieldValue(field.key)} variables={variables} config={config}
              instructionOutputFields={instructionOutputFields}
              onChange={(key, val) => onUpdate(node.id, key, val)} />
            {/* Helper text under the field — registry `hint:`/`help:` through the render-layer i18n (§5). */}
            {(field.hint ?? field.help) ? <Caption style={{ display: 'block', marginTop: 4 }}>{fieldHint(t, (field.hint ?? field.help) as string)}</Caption> : null}
            {/* WA-RECIPIENT-FIELD-1: the value the server would refuse is named here, before the 422. */}
            {invalidMsg && (
              <Caption style={{ display: 'block', marginTop: 4, color: 'var(--color-danger-text)' }}>{fieldHint(t, invalidMsg)}</Caption>
            )}
            {/* Required-and-empty hint shows regardless of a registry hint, so a required field with a hint still surfaces it (SCHERMWAARHEID-1). */}
            {isRequired && isEmpty && (
              <Caption style={{ display: 'block', marginTop: 4, color: 'var(--color-danger-text)' }}>{t('fields.requiredHint')}</Caption>
            )}
          </div>
        )
      })}
      {fields.length === 0 && type !== 'router' && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('config.noConfig')}</p>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Module header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 0', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icon && <Icon size={16} color={meta?.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionTitle style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('modules.' + type, { defaultValue: meta?.label ?? type })}</SectionTitle>
          <Caption>{t('categories.' + categorySlug(meta?.category), { defaultValue: meta?.category ?? '' })}</Caption>
        </div>
        {/* HUISSTIJL-1: icon-action → Button iconOnly ghost; the hover-driven danger
            colour rides along via onMouseEnter/onMouseLeave (Button forwards native
            button props), so the imperative hover behaviour is unchanged. */}
        <Button variant="ghost" iconOnly onClick={() => onDelete(node.id)}
          style={{ color: 'var(--border)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
          title={t('config.deleteTitle')} aria-label={t('config.deleteTitle')}>
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Tab bar — ai_agent gets 4 dedicated tabs; all others get 2. The shared
          DrawerTabs atom carries the identical underline-active identity plus
          proper tablist/roving-tabindex a11y the hand-rolled buttons lacked. */}
      <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '8px 16px 0', overflowX: 'auto' }}>
        <DrawerTabs
          tabs={isAgent ? [
            // ai_agent tabs — through i18n like everything else (§5; was hardcoded Dutch).
            { id: 'general',   label: t('config.tabStandard') },
            // Danny 31-08: the AI-instructies list is long — its own tab keeps Standaard readable.
            { id: 'instructions', label: t('config.tabInstructions') },
            { id: 'advanced', label: t('config.tabAdvanced') },
            { id: 'testing',      label: `▶ ${t('config.tabTest')}` },
            { id: 'execution',  label: output ? `${t('config.tabExecution')} (${Array.isArray(output) ? output.length : 1})` : t('config.tabExecution') },
          ] : [
            { id: 'settings', label: t('config.tabSettings') },
            // WEBHOOK-LOG-FE-2: the Webhook Trigger step gets its own "Verzoeken"
            // tab, reaching the same per-webhook request log Settings shows.
            ...(isWebhookTrigger ? [{ id: 'requests', label: t('config.tabRequests') }] : []),
            // 02-09: a "Vertalingen" tab only when this module's schema actually
            // declares a translations-tab field AND its showIf currently passes
            // (e.g. whatsapp_send's translations field only applies to the
            // free-text 'session' format, never to 'template' — Danny: "Bij
            // template kan dit niet.") — never shown on modules/states with
            // nothing to translate.
            ...(translationsFieldCount > 0
              ? [{ id: 'translations', label: t('config.tabTranslations') }]
              : []),
            { id: 'execution',   label: output ? `${t('config.tabExecution')} (${Array.isArray(output) ? output.length : 1})` : t('config.tabExecution') },
          ]}
          active={activeTab} onChange={switchTab} />
      </div>

      {/* ── AI Agent tab content ─────────────────────────────────────────────── */}
      {isAgent && activeTab === 'general'   && renderFields(fieldsForTab('general'))}
      {isAgent && activeTab === 'instructions' && renderFields(fieldsForTab('instructions'))}
      {isAgent && activeTab === 'advanced' && renderFields(fieldsForTab('advanced'))}
      {isAgent && activeTab === 'testing'      && (
        <AgentTestPanel config={config} />
      )}
      {isAgent && activeTab === 'execution'  && (
        <ExecutionOutputPane output={output} fanout={fanout} noOutputLabel={t('config.noOutput')} />
      )}

      {/* ── Standard settings + execution (non-agent) ───────────────────── */}
      {!isAgent && activeTab === 'settings' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schema
            // 02-09: fields tagged with a `tab` (e.g. translations) live on their
            // own tab, never on the main settings list (MODULE-FACE-BEVRIES).
            .filter(field => !(field as WorkflowField & { tab?: string }).tab)
            .filter(field => {
              const showIf = field.showIf as { key: string; value: unknown } | undefined
              if (!showIf) return true
              const ctrl = schema.find(f => f.key === showIf.key)
              const cur  = config?.[showIf.key] ?? ctrl?.default
              const want = showIf.value
              return Array.isArray(want) ? want.includes(cur) : cur === want
            })
            .map(field => {
              // SCHERMWAARHEID-1: 'required' was display-only on the ai_agent tab
              // path — the settings path silently dropped the asterisk. Honest
              // now on both, plus a hint when a required select is still empty
              // (no save-blocking: the editor has none, the engine fails visibly).
              const { isRequired, isEmpty, invalidMsg } = fieldFlags(field as WorkflowField)
              return (
                <div key={field.key}>
                  {/* REQUIRED-A11Y-1: shared house asterisk (fields.tsx); see the
                      renderFields comment above for why aria-required stays a gap here. */}
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {fieldLabel(t, field.label as string | undefined)}
                    {isRequired && requiredMark}
                  </label>
                  <FieldInput field={field as WorkflowField} value={fieldValue(field.key)} variables={variables} config={config}
                    instructionOutputFields={instructionOutputFields}
                    onChange={handleFieldChange} />
                  {/* K-193 fase 2b: on message_type, the wa_web-specific caption below
                      replaces the registry help (avoid printing the same notice twice). */}
                  {(() => {
                    const isWaWebMessageType = type === 'whatsapp_send' && field.key === 'message_type' && config?.channel === 'wa_web'
                    if (isWaWebMessageType) return null
                    return (field.hint ?? field.help)
                      ? <Caption style={{ display: 'block', marginTop: 4 }}>{fieldHint(t, (field.hint ?? field.help) as string)}</Caption>
                      : null
                  })()}
                  {/* WA-RECIPIENT-FIELD-1: the value the server would refuse is named here, before the 422. */}
                  {invalidMsg && (
                    <Caption style={{ display: 'block', marginTop: 4, color: 'var(--color-danger-text)' }}>{fieldHint(t, invalidMsg)}</Caption>
                  )}
                  {/* K-193 fase 2b: WhatsApp Web only ever sends a session message. */}
                  {type === 'whatsapp_send' && field.key === 'message_type' && config?.channel === 'wa_web' && (
                    <Caption style={{ display: 'block', marginTop: 4 }}>{t('fields.waWebSessionOnly')}</Caption>
                  )}
                  {/* Required-and-empty hint shows regardless of a registry hint, so a required field with a hint still surfaces it (SCHERMWAARHEID-1). */}
                  {isRequired && isEmpty && (
                    <Caption style={{ display: 'block', marginTop: 4, color: 'var(--color-danger-text)' }}>{t('fields.requiredHint')}</Caption>
                  )}
                </div>
              )
            })}
          {schema.length === 0 && (
            type === 'router' ? (
              <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SectionTitle as="p" style={{ margin: 0 }}>{t('config.routerTitle')}</SectionTitle>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{t('config.routerDesc')}</p>
                <Caption style={{ display: 'block' }}>{t('config.routerNote')}</Caption>
              </div>
            ) : config && Object.keys(config).length > 0 ? (
              // Unknown module type (not in the FE registry): show its stored config
              // read-only so opening it is never blank. Editable config needs the
              // module in src/modules/ (or a BE-driven schema).
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(config).map(([k, v]) => (
                  <div key={k}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k}</label>
                    <BodyText style={{ wordBreak: 'break-word' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                    </BodyText>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('config.noConfig')}</p>
            )
          )}
        </div>
      )}
      {/* WEBHOOK-LOG-FE-2: the "Verzoeken" tab — the same per-webhook request log
          Settings → Integraties → Webhooks shows, for the webhook this step picked.
          No webhook picked yet ⇒ a calm pointer to Settings, never an empty table
          (§3 no fake affordance). */}
      {isWebhookTrigger && activeTab === 'requests' && (
        config?.webhook_id
          ? <Suspense fallback={null}>
              <WebhookRequestsLog compact webhookId={config.webhook_id as string | number}
                webhookName={webhooks.find(h => String(h.id) === String(config.webhook_id))?.name ?? String(config.webhook_id)} />
            </Suspense>
          : <div style={{ padding: 16 }}><Caption>{t('config.requestsPickWebhook')}</Caption></div>
      )}
      {/* 02-09: the "Vertalingen" tab — reuses the shared field renderer so hint/
          required decoration stays identical to the main settings list. */}
      {!isAgent && activeTab === 'translations' && renderFields(fieldsForTab('translations'))}
      {!isAgent && activeTab === 'execution' && (
        <ExecutionOutputPane output={output} fanout={fanout} noOutputLabel={t('config.noOutput')}>
          {waQueued != null && <Caption style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>{t('fields.whatsappQueued', { count: waQueued })}</Caption>}
          {Array.isArray(output) && <Caption style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>{t('config.itemsCount', { count: output.length })}</Caption>}
        </ExecutionOutputPane>
      )}
    </div>
  )
}
