/**
 * ConfigPanel — the right side panel that configures the selected module: its
 * header (icon/label/category + delete), the settings tab (schema fields via
 * FieldInput), the execution-output tab, and — for the AI agent module — the
 * management tabs (Agents/Prompts/FAQ/Knowledge/Tools). Extracted from
 * WorkflowCanvasEditor. `MANAGE_TABS` is re-used by the editor to widen the panel.
 */
import { useState, useEffect } from 'react'
import { Zap, Trash2, Play } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MODULE_META, MODULE_SCHEMAS } from '@/modules/index'
import { AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab } from '@/components/ai/AIManagementTabs'
import { FieldInput } from './fields'
import { categorySlug } from './moduleI18n'
import AgentTestPanel from './AgentTestPanel'
import type { FlowNode, WorkflowField, WorkflowVarGroup } from '@/types/workflow'

// '__wide__' is a sentinel that signals the editor to widen the right panel
export const MANAGE_TABS = ['agents', 'prompts', 'faq', 'knowledge', 'tools', '__wide__']

export default function ConfigPanel({ node, onUpdate, onDelete, onTabChange, variables = [] }: {
  node: FlowNode | null
  onUpdate: (nodeId: string, key: string, val: unknown) => void
  onDelete: (nodeId: string) => void
  onTabChange?: (tab: string) => void
  variables?: WorkflowVarGroup[]
}) {
  const { t } = useTranslation('workflows')
  const isAgent = node?.data.type === 'ai_agent'
  const [activeTab, setActiveTab] = useState(() => isAgent ? 'standaard' : 'instellingen')

  // Widen panel for ai_agent by emitting sentinel; narrow for all other modules
  const switchTab = (id: string) => {
    setActiveTab(id)
    onTabChange?.(isAgent ? '__wide__' : id)
  }

  // Reset to correct first tab when node changes
  useEffect(() => {
    const first = node?.data.type === 'ai_agent' ? 'standaard' : 'instellingen'
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
      {fields.map(field => (
        <div key={field.key}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {String(field.label ?? '')}
            {!!(field as WorkflowField & { required?: boolean }).required && <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>}
          </label>
          <FieldInput field={field as WorkflowField} value={config?.[field.key]} variables={variables}
            onChange={(key, val) => onUpdate(node.id, key, val)} />
          {field.hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{field.hint as string}</div> : null}
        </div>
      ))}
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
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('modules.' + type, { defaultValue: meta?.label ?? type })}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('categories.' + categorySlug(meta?.category), { defaultValue: meta?.category ?? '' })}</div>
        </div>
        <button onClick={() => onDelete(node.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 4, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
          title={t('config.deleteTitle')}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tab bar — ai_agent gets 4 dedicated tabs; all others get 2 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '8px 16px 0', overflowX: 'auto' }}>
        {(isAgent ? [
          { id: 'standaard',   label: 'Standaard' },
          { id: 'geavanceerd', label: 'Geavanceerd' },
          { id: 'testen',      label: '▶ Testen' },
          { id: 'uitvoering',  label: output ? `Uitvoering (${Array.isArray(output) ? output.length : 1})` : 'Uitvoering' },
        ] : [
          { id: 'instellingen', label: t('config.tabSettings') },
          { id: 'uitvoering',   label: output ? `${t('config.tabExecution')} (${Array.isArray(output) ? output.length : 1})` : t('config.tabExecution') },
          ...(type === 'ai_agent' ? [] : []),
        ]).map(tab => (
          <button key={tab.id} type="button" onClick={() => switchTab(tab.id)}
            style={{
              padding: '5px 10px', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── AI Agent tab content ─────────────────────────────────────────────── */}
      {isAgent && activeTab === 'standaard'   && renderFields(fieldsForTab('standaard'))}
      {isAgent && activeTab === 'geavanceerd' && renderFields(fieldsForTab('geavanceerd'))}
      {isAgent && activeTab === 'testen'      && (
        <AgentTestPanel config={config} />
      )}
      {isAgent && activeTab === 'uitvoering'  && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
                <Play size={24} color="var(--border)" />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{t('config.noOutput')}</p>
              </div>
            : <div style={{ padding: 12 }}><pre style={{ fontSize: 11, lineHeight: 1.6, color: '#E2E8F0', background: '#1E293B', borderRadius: 8, padding: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(output, null, 2)}</pre></div>}
        </div>
      )}

      {/* ── Non-agent management tabs (legacy/other modules) ─────────────────── */}
      {!isAgent && activeTab === 'agents'    && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><AgentsTab /></div>}
      {!isAgent && activeTab === 'prompts'   && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><PromptsTab /></div>}
      {!isAgent && activeTab === 'faq'       && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><FAQTab /></div>}
      {!isAgent && activeTab === 'knowledge' && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><KnowledgeTab /></div>}
      {!isAgent && activeTab === 'tools'     && <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}><ToolsTab /></div>}

      {/* ── Standard instellingen + uitvoering (non-agent) ───────────────────── */}
      {!isAgent && activeTab === 'instellingen' && (
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
            .map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  {field.label}
                </label>
                <FieldInput field={field as WorkflowField} value={config?.[field.key]} variables={variables}
                  onChange={(key, val) => onUpdate(node.id, key, val)} />
                {field.hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{field.hint as string}</div> : null}
              </div>
            ))}
          {schema.length === 0 && (
            type === 'router' ? (
              <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t('config.routerTitle')}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{t('config.routerDesc')}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('config.routerNote')}</p>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('config.noConfig')}</p>
            )
          )}
        </div>
      )}
      {!isAgent && activeTab === 'uitvoering' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
                <Play size={24} color="var(--border)" />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{t('config.noOutput')}</p>
              </div>
            : <div style={{ padding: 12 }}>
                {Array.isArray(output) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{output.length} {output.length === 1 ? t('config.item') : t('config.items')}</div>}
                <pre style={{ fontSize: 11, lineHeight: 1.6, color: '#E2E8F0', background: '#1E293B', borderRadius: 8, padding: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(output, null, 2)}</pre>
              </div>}
        </div>
      )}
    </div>
  )
}
