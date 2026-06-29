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
import { MODULE_META, MODULE_SCHEMAS } from '@/modules/index'
import { AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab } from '../../ai/AIManagementTabs'
import { FieldInput } from './fields'
import type { FlowNode, WorkflowField } from '@/types/workflow'

export const MANAGE_TABS = ['agents', 'prompts', 'faq', 'knowledge', 'tools']

export default function ConfigPanel({ node, onUpdate, onDelete, onTabChange }: {
  node: FlowNode | null
  onUpdate: (nodeId: string, key: string, val: unknown) => void
  onDelete: (nodeId: string) => void
  onTabChange?: (tab: string) => void
}) {
  const [activeTab, setActiveTab] = useState('instellingen')

  const switchTab = (id: string) => { setActiveTab(id); onTabChange?.(id) }

  // Reset tab when selected node changes
  useEffect(() => { setActiveTab('instellingen'); onTabChange?.('instellingen') }, [node?.id])

  if (!node) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={20} color="var(--border)" />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>Klik op een module<br />om de configuratie te zien</p>
      </div>
    )
  }
  const type   = node.data.type ?? ''
  const meta   = MODULE_META[type]
  const schema = MODULE_SCHEMAS[type] || []
  const Icon   = meta?.Icon as unknown as LucideIcon | undefined
  const output = node.data.output

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Module header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 0', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icon && <Icon size={16} color={meta?.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta?.category}</div>
        </div>
        <button onClick={() => onDelete(node.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 4, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
          title="Module verwijderen">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '8px 16px 0', overflowX: 'auto' }}>
        {[
          { id: 'instellingen', label: 'Instellingen' },
          { id: 'uitvoering',   label: output ? `Uitvoering (${Array.isArray(output) ? output.length : 1})` : 'Uitvoering' },
          ...(node.data.type === 'ai_agent' ? [
            { id: 'agents',    label: 'Agents' },
            { id: 'prompts',   label: 'Prompts' },
            { id: 'faq',       label: "FAQ's" },
            { id: 'knowledge', label: 'Kennisbank' },
            { id: 'tools',     label: 'Tools' },
          ] : []),
        ].map(t => (
          <button key={t.id} type="button" onClick={() => switchTab(t.id)}
            style={{
              padding: '5px 10px', fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? 'var(--color-primary)' : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — management tabs */}
      {activeTab === 'agents'    && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><AgentsTab /></div>}
      {activeTab === 'prompts'   && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><PromptsTab /></div>}
      {activeTab === 'faq'       && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><FAQTab /></div>}
      {activeTab === 'knowledge' && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><KnowledgeTab /></div>}
      {activeTab === 'tools'     && <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}><ToolsTab /></div>}

      {/* Tab content */}
      {activeTab === 'instellingen' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schema
            .filter(field => {
              const showIf = field.showIf as { key: string; value: unknown } | undefined
              if (!showIf) return true
              const ctrl = schema.find(f => f.key === showIf.key)
              const cur  = node.data.config?.[showIf.key] ?? ctrl?.default
              const want = showIf.value
              return Array.isArray(want) ? want.includes(cur) : cur === want
            })
            .map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                {field.label}
              </label>
              <FieldInput field={field as WorkflowField} value={node.data.config?.[field.key]}
                onChange={(key, val) => onUpdate(node.id, key, val)} />
              {field.hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{field.hint as string}</div> : null}
            </div>
          ))}
          {schema.length === 0 && (
            node.data.type === 'router' ? (
              <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Router</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  Verbind de Router naar meerdere modules op het canvas. Klik op het <strong>filter-icoontje</strong> op een verbindingslijn om te bepalen wanneer die route wordt gevolgd.
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                  Geen overeenkomende route → de flow stopt voor die tak.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Geen configuratie vereist.</p>
            )
          )}
        </div>
      ) : !MANAGE_TABS.includes(activeTab) ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
              <Play size={24} color="var(--border)" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                Nog geen uitvoerdata.<br />Druk op ▶ bij de module om te testen.
              </p>
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              {Array.isArray(output) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
                  {output.length} {output.length === 1 ? 'item' : 'items'}
                </div>
              )}
              <pre style={{
                fontSize: 11, lineHeight: 1.6, color: '#E2E8F0', background: '#1E293B',
                borderRadius: 8, padding: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              }}>
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
