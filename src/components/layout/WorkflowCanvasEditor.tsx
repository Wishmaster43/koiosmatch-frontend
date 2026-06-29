/**
 * WorkflowCanvasEditor — the visual drag-and-drop workflow builder.
 *
 * Renders the node graph (via @xyflow/react / ReactFlow): the canvas, nodes,
 * connecting edges, minimap and controls, plus the header toolbar and the side
 * panels. All editor state + behaviour lives in `useWorkflowEditor`; the panels
 * live in `./workflow/` (ModulePicker · ConfigPanel · LogsPanel · fields · canvas
 * · ScheduleModal). This component stays declarative: hook in, JSX out.
 */
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
} from '@xyflow/react'
import type { NodeTypes, EdgeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { X, Save, Play, Loader2, Plus, Zap, List, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MODULE_META } from '@/modules/index'
import { ScheduleModal, scheduleLabel } from './workflow/ScheduleModal'
import { EdgeAddContext, EdgeDeleteContext, EdgeFilterContext, NodeRunContext, StartContext } from './workflow/contexts'
import { EdgeFilterPanel, OutputPanel, NODE_TYPES, EDGE_TYPES } from './workflow/canvas'
import ModulePicker from './workflow/ModulePicker'
import ConfigPanel, { MANAGE_TABS } from './workflow/ConfigPanel'
import LogsPanel from './workflow/LogsPanel'
import { useWorkflowEditor } from './workflow/useWorkflowEditor'
import type { Workflow, EdgeFilters } from '@/types/workflow'

// ── Inner editor ──────────────────────────────────────────────────────────────

function EditorInner({ workflow, onClose, onSave }: {
  workflow: Workflow
  onClose: () => void
  onSave: (updated: Workflow, closeAfter?: boolean) => void
}) {
  const {
    edges, onNodesChange, onEdgesChange, onConnect, nodesWithFirst, selectedNode, setSelectedNodeId,
    name, setName, trigger, setTrigger, scheduleConfig, setScheduleConfig, status, setStatus,
    saved, running, showSchedule, setShowSchedule, widePanelActive, setWidePanelActive, showLogs, setShowLogs,
    pickerState, setPickerState, filterState, setFilterState, outputState, setOutputState,
    firstNodeId, setStartNodeId,
    handleEdgeAdd, handleEdgeDelete, handleEdgeFilter, saveEdgeFilter, handleNodeRun,
    insertModule, updateNodeConfig, deleteNode, handleSave, handleRun,
  } = useWorkflowEditor({ workflow, onSave })
  const { t } = useTranslation('workflows')

  return (
    <StartContext.Provider value={{ startNodeId: firstNodeId ?? null, setStartNodeId }}>
    <EdgeAddContext.Provider value={handleEdgeAdd}>
    <EdgeDeleteContext.Provider value={handleEdgeDelete}>
    <EdgeFilterContext.Provider value={handleEdgeFilter}>
    <NodeRunContext.Provider value={handleNodeRun}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#F5F5F7' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          height: 56, padding: '0 20px', flexShrink: 0,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color="var(--color-primary)" />
            </div>
            <input
              value={name} onChange={e => setName(e.target.value)}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', border: 'none', background: 'transparent', outline: 'none', minWidth: 60, maxWidth: 240 }}
            />
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

          <button onClick={() => setShowSchedule(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--hover-bg)', cursor: 'pointer',
              fontSize: 12, color: 'var(--text)', fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}>
            <Clock size={13} color="var(--text-muted)" />
            {scheduleLabel(trigger, scheduleConfig)}
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

          <button onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
              background: status === 'active' ? 'var(--color-success-bg)' : 'var(--hover-bg)',
              color:      status === 'active' ? 'var(--color-success)' : 'var(--text-muted)',
              border:     `1px solid ${status === 'active' ? '#BBF7D0' : 'var(--border)'}`,
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? 'var(--color-success)' : 'var(--border)' }} />
            {status === 'active' ? t('status.active') : t('status.inactive')}
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setShowLogs(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: showLogs ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
              color:      showLogs ? 'var(--color-primary)'    : 'var(--text-muted)',
              border:     `1px solid ${showLogs ? 'var(--color-primary)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            <List size={13} />
            {t('editor.logs')}
          </button>

          <button onClick={handleRun} disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: running ? 'var(--border)' : 'var(--color-primary-bg)',
              color:      running ? 'var(--text-muted)' : 'var(--color-primary)',
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            }}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? t('editor.running') : t('editor.run')}
          </button>

          {/* Opslaan — blijft in editor */}
          <button onClick={() => handleSave(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: saved ? 'var(--color-success-bg)' : 'var(--hover-bg)',
              color: saved ? 'var(--color-success)' : 'var(--text)',
              border: `1px solid ${saved ? 'var(--color-success)' : 'var(--border)'}`,
              cursor: 'pointer', transition: 'background 0.2s',
            }}>
            <Save size={13} />
            {saved ? t('editor.saved') : t('editor.save')}
          </button>

          {/* Opslaan & sluiten — terug naar overzicht */}
          <button onClick={() => handleSave(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: 'var(--color-primary)', color: 'white',
              border: 'none', cursor: 'pointer',
            }}>
            <Save size={13} />
            {t('editor.saveClose')}
          </button>

          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            title={t('editor.closeTitle')}>
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
              nodes={nodesWithFirst}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={NODE_TYPES as unknown as NodeTypes}
              edgeTypes={EDGE_TYPES as unknown as EdgeTypes}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.35 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--border)" gap={20} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                nodeColor={n => MODULE_META[(n.data?.type as string) ?? '']?.color ?? 'var(--border)'}
                nodeStrokeWidth={0}
                style={{ borderRadius: 10, border: '1px solid var(--border)' }}
              />
            </ReactFlow>

            {/* Floating add button */}
            <button
              onClick={() => setPickerState({ append: true })}
              style={{
                position: 'absolute', bottom: 24, right: 24,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 999,
                background: 'var(--color-primary)', color: 'white',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                zIndex: 10,
              }}>
              <Plus size={15} />
              {t('editor.addModule')}
            </button>
          </div>

          {/* Right panel — widens when management tabs (Agents/Prompts/FAQ/etc.) are active */}
          <div style={{ width: widePanelActive ? 560 : 280, flexShrink: 0, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s ease' }}>
            {showLogs
              ? <LogsPanel workflowId={workflow.id} onClose={() => setShowLogs(false)} />
              : <ConfigPanel node={selectedNode} onUpdate={updateNodeConfig} onDelete={deleteNode}
                  onTabChange={tab => setWidePanelActive(MANAGE_TABS.includes(tab))} />
            }
          </div>
        </div>

        {/* Schedule modal */}
        {showSchedule && (
          <ScheduleModal
            trigger={trigger}
            scheduleConfig={scheduleConfig}
            onSave={(newTrigger, newCfg) => {
              setTrigger(newTrigger)
              setScheduleConfig(newCfg)
              setShowSchedule(false)
            }}
            onClose={() => setShowSchedule(false)}
          />
        )}

        {/* Module picker */}
        {pickerState && (
          <ModulePicker
            insertAfterEdgeId={pickerState.edgeId ?? null}
            onSelect={insertModule}
            onClose={() => setPickerState(null)}
          />
        )}
        {filterState && (
          <EdgeFilterPanel
            filters={edges.find(e => e.id === filterState.edgeId)?.data?.filters as EdgeFilters | null | undefined}
            onClose={() => setFilterState(null)}
            onSave={(filters) => saveEdgeFilter(filterState.edgeId, filters)}
          />
        )}
        {outputState && (
          <OutputPanel
            output={outputState.output}
            onClose={() => setOutputState(null)}
          />
        )}
      </div>
    </NodeRunContext.Provider>
    </EdgeFilterContext.Provider>
    </EdgeDeleteContext.Provider>
    </EdgeAddContext.Provider>
    </StartContext.Provider>
  )
}

// ── Public export wrapped in ReactFlowProvider ────────────────────────────────

export default function WorkflowCanvasEditor(props: {
  workflow: Workflow
  onClose: () => void
  onSave: (updated: Workflow, closeAfter?: boolean) => void
}) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
