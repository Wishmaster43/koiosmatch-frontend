/**
 * ConfigPanel — the right side panel that configures the selected module: its
 * header (icon/label/category + delete), the settings tab (schema fields via
 * FieldInput) and the execution-output tab. For the AI agent module it also
 * renders the Standard/Advanced/Test/Output tabs. Extracted from WorkflowCanvasEditor.
 */
import { useState, useEffect } from 'react'
import { Zap, Trash2, Play } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionTitle, Caption, BodyText } from '@/components/ui/typography'
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
  const [activeTab, setActiveTab] = useState(() => isAgent ? 'general' : 'settings')

  // Widen panel for ai_agent by emitting sentinel; narrow for all other modules
  const switchTab = (id: string) => {
    setActiveTab(id)
    onTabChange?.(isAgent ? '__wide__' : id)
  }

  // Reset to correct first tab when node changes
  useEffect(() => {
    const first = node?.data.type === 'ai_agent' ? 'general' : 'settings'
    setActiveTab(first)
    onTabChange?.(node?.data.type === 'ai_agent' ? '__wide__' : first)
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Helper: filter schema fields by tab and showIf
  const fieldsForTab = (tab: string) => schema.filter(field => {
    const f = field as WorkflowField & { tab?: string }
    if (f.tab && f.tab !== tab) return false
    const showIf = field.showIf as { key: string; value: unknown } | undefined
    if (!showIf) return true
    const ctrl = schema.find(s => s.key === showIf.key)
    const cur  = config?.[showIf.key] ?? ctrl?.default
    const want = showIf.value
    return Array.isArray(want) ? want.includes(cur) : cur === want
  })

  // Shared field list renderer
  const renderFields = (fields: typeof schema) => (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {fields.map(field => {
        const isRequired = !!(field as WorkflowField & { required?: boolean }).required
        const isEmpty    = fieldValue(field.key) == null || fieldValue(field.key) === ''
        return (
          <div key={field.key}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {fieldLabel(t, field.label as string | undefined)}
              {isRequired && <span style={{ color: 'var(--color-danger-text)', marginLeft: 3 }}>*</span>}
            </label>
            <FieldInput field={field as WorkflowField} value={fieldValue(field.key)} variables={variables} config={config}
              instructionOutputFields={instructionOutputFields}
              onChange={(key, val) => onUpdate(node.id, key, val)} />
            {/* Helper text under the field — registry `hint:`/`help:` through the render-layer i18n (§5). */}
            {(field.hint ?? field.help) ? <Caption style={{ display: 'block', marginTop: 4 }}>{fieldHint(t, (field.hint ?? field.help) as string)}</Caption> : null}
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
                <Play size={24} color="var(--border)" />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{t('config.noOutput')}</p>
              </div>
            : <div style={{ padding: 12 }}>
                {fanout && <FanoutSummary fanout={fanout} />}
                <OutputTree data={output} />
              </div>}
        </div>
      )}

      {/* ── Standard settings + execution (non-agent) ───────────────────── */}
      {!isAgent && activeTab === 'settings' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schema
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
              const isRequired = !!(field as WorkflowField & { required?: boolean }).required
              const isEmpty    = fieldValue(field.key) == null || fieldValue(field.key) === ''
              return (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {fieldLabel(t, field.label as string | undefined)}
                    {isRequired && <span style={{ color: 'var(--color-danger-text)', marginLeft: 3 }}>*</span>}
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
      {!isAgent && activeTab === 'execution' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
                <Play size={24} color="var(--border)" />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{t('config.noOutput')}</p>
              </div>
            : <div style={{ padding: 12 }}>
                {fanout && <FanoutSummary fanout={fanout} />}
                {waQueued != null && <Caption style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>{t('fields.whatsappQueued', { count: waQueued })}</Caption>}
                {Array.isArray(output) && <Caption style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>{t('config.itemsCount', { count: output.length })}</Caption>}
                <OutputTree data={output} />
              </div>}
        </div>
      )}
    </div>
  )
}
