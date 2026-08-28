/**
 * WorkflowCanvasEditor — the visual drag-and-drop workflow builder.
 *
 * Renders the node graph (via @xyflow/react / ReactFlow): the canvas, nodes,
 * connecting edges, minimap and controls, plus the header toolbar and the side
 * panels. All editor state + behaviour lives in `useWorkflowEditor`; the exit
 * guards in `useEditorExitGuards`; the panels in `./workflow/` (WorkflowEditorHeader
 * · ModulePicker · ConfigPanel · LogsPanel · fields · canvas · ScheduleModal).
 * This component stays declarative: hook in, JSX out.
 */
import { useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
} from '@xyflow/react'
import type { NodeTypes, EdgeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '@/hooks/useConfirm'
import { MODULE_META } from '@/modules/index'
import { ScheduleModal } from './workflow/ScheduleModal'
import { EdgeAddContext, EdgeDeleteContext, EdgeFilterContext, NodeRunContext, StartContext, CurrentWorkflowContext } from './workflow/contexts'
import { OutputPanel, NODE_TYPES, EDGE_TYPES } from './workflow/canvas'
import { EdgeFilterPanel } from './workflow/EdgeFilterPanel'
import ModulePicker from './workflow/ModulePicker'
import ConfigPanel from './workflow/ConfigPanel'
import LogsPanel from './workflow/LogsPanel'
import WorkflowHistoryView from './workflow/WorkflowHistoryView'
import WorkflowRelationsView from './workflow/WorkflowRelationsView'
import WorkflowEditorHeader from './workflow/WorkflowEditorHeader'
import type { EditorView } from './workflow/WorkflowEditorHeader'
import { useWorkflowEditor } from './workflow/useWorkflowEditor'
import { useEditorExitGuards } from './workflow/useEditorExitGuards'
import { useModuleCatalog } from './workflow/useModuleCatalog'
import type { Workflow } from '@/types/workflow'
import type { RunRow } from '@/types/reports'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

// ── Inner editor ──────────────────────────────────────────────────────────────

function EditorInner({ workflow, onClose, onSave, initialRunId }: {
  workflow: Workflow
  onClose: () => void
  onSave: (updated: Workflow, closeAfter?: boolean) => void
  initialRunId?: string | number | null
}) {
  const {
    edges, onNodesChange, onEdgesChange, onConnect, nodesWithFirst, selectedNode, setSelectedNodeId,
    name, setName, trigger, setTrigger, scheduleConfig, setScheduleConfig, status, setStatus,
    saved, running, runError, setRunError, showSchedule, setShowSchedule, widePanelActive, setWidePanelActive, showLogs, setShowLogs,
    liveRun, activeRunId, liveRunActive, runConflict, handleStopped,
    pickerState, setPickerState, filterState, setFilterState, outputState, setOutputState,
    firstNodeId, setStartNodeId, getUpstreamVariables,
    handleEdgeAdd, handleEdgeDelete, handleEdgeFilter, saveEdgeFilter, handleNodeRun,
    insertModule, updateNodeConfig, deleteNode, handleSave, handleRun, isDirty,
  } = useWorkflowEditor({ workflow, onSave, initialRunId })
  const { t } = useTranslation('workflows')
  const { confirm, dialog } = useConfirm()

  // WF-DRYRUN-FE-1: an HONEST confirm before the dry run actually fires — it
  // names exactly which modules are skipped (the send modules) and states
  // plainly that everything else really mutates, same as a normal run.
  const handleRunDryRun = () =>
    confirm(t('editor.dryRunConfirmMessage'), () => handleRun({ dryRun: true }), { title: t('editor.dryRunConfirmTitle') })

  // Leaving the editor (X, browser-back, tab close) runs one guarded action —
  // unsaved-changes + live-run confirms live in the hook.
  const confirmClose = useEditorExitGuards({ isDirty, liveRunActive, onClose, confirm })
  // Esc = the same guarded exit as the X (block 1 point 3.3), as a LAYER on
  // the one escape stack (TRIAGE-3.3): nested panels register above the editor,
  // so their Escape wins first and the guarded exit only fires on top.
  useEscapeLayer(true, confirmClose)

  // Top-level editor view: the node diagram, this workflow's run history, or
  // its parent/child relations (WF-RELATIONS-FE-1).
  const [view, setView] = useState<EditorView>('diagram')
  // LOGS-DRILL-1 (Danny 23-07): jumping from a Logs-panel row lands on the
  // History tab with that run's detail drawer already open. A FRESH wrapper
  // per click, so jumping to the same run twice re-opens the drawer too.
  const [historyRun, setHistoryRun] = useState<{ row: RunRow } | null>(null)
  // Output fields of upstream modules the selected node may reference as tokens.
  const upstreamVariables = getUpstreamVariables(selectedNode?.id)
  // Backend bundle-shape catalog (output_fields + emits per module type) for the
  // Make-style filter field picker (FILTER-VELD-1) — fetched once, shared by every
  // EdgeFilterPanel open in this session.
  const { catalog: moduleCatalog } = useModuleCatalog()
  const filterEdge = edges.find(e => e.id === filterState?.edgeId)

  return (
    // WF-PICKER-SELF-1: exposes this workflow's own id so a picker (e.g.
    // workflow_call's workflow_id field) can exclude self-reference without a
    // 3-hop prop drill through ConfigPanel -> FieldInput -> the field control.
    <CurrentWorkflowContext.Provider value={workflow.id ?? null}>
    <StartContext.Provider value={{ startNodeId: firstNodeId ?? null, setStartNodeId }}>
    <EdgeAddContext.Provider value={handleEdgeAdd}>
    <EdgeDeleteContext.Provider value={handleEdgeDelete}>
    <EdgeFilterContext.Provider value={handleEdgeFilter}>
    <NodeRunContext.Provider value={handleNodeRun}>
      {/* HUISSTIJL-1: full-screen editor takeover — modal/dialog role. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-overlay)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

        {/* ── Header ── */}
        <WorkflowEditorHeader
          workflowId={workflow.id}
          name={name} onNameChange={setName}
          view={view} onViewChange={setView}
          trigger={trigger} scheduleConfig={scheduleConfig} onOpenSchedule={() => setShowSchedule(true)}
          status={status} onToggleStatus={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
          showLogs={showLogs} onToggleLogs={() => setShowLogs(s => !s)}
          runError={runError} onRunError={setRunError} runConflict={runConflict}
          liveRunActive={liveRunActive} activeRunId={activeRunId} onStopped={handleStopped}
          running={running} onRun={handleRun} onRunDryRun={handleRunDryRun}
          saved={saved} onSave={() => handleSave(false)}
          // Save & close — back to the overview (live-run guard first)
          onSaveClose={() => (liveRunActive ? confirm(t('editor.liveRunConfirm'), () => handleSave(true)) : handleSave(true))}
          onClose={confirmClose}
        />

        {/* ── Body ── */}
        {view === 'history' ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <WorkflowHistoryView workflowId={workflow.id} initialRun={historyRun} />
          </div>
        ) : view === 'relations' ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <WorkflowRelationsView workflowId={workflow.id} />
          </div>
        ) : (
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
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- FAB floating over the ReactFlow canvas (round, floating, shadow-float): a face Button deliberately does not model
              style={{
                position: 'absolute', bottom: 24, right: 24,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 999,
                // FAB fill now reads the button trio (--button-fill/--button-ink), so a tenant's branding applies here too.
                background: 'var(--button-fill)', color: 'var(--button-ink)',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                boxShadow: 'var(--shadow-float)',
                // HUISSTIJL-1: orders this FAB above the ReactFlow canvas' own siblings
                // (controls/minimap) INSIDE the relatively-positioned canvas container —
                // internal layering, exempt from the z-ladder.
                zIndex: 10,
              }}>
              <Plus size={15} />
              {t('editor.addModule')}
            </button>
          </div>

          {/* Right panel — widens when management tabs (Agents/Prompts/FAQ/etc.) are active */}
          {/* Config panel is roomy (440) but leaves the canvas room; logs and the
              management tabs need the full width for their tables/item lists (640). */}
          <div style={{ width: (showLogs || widePanelActive) ? 640 : 440, flexShrink: 0, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s ease' }}>
            {showLogs
              ? <LogsPanel workflowId={workflow.id} liveRun={liveRun} onClose={() => setShowLogs(false)}
                  onOpenHistory={run => { setHistoryRun({ row: run }); setView('history') }} />
              : <ConfigPanel node={selectedNode} onUpdate={updateNodeConfig} onDelete={deleteNode}
                  variables={upstreamVariables}
                  onTabChange={tab => setWidePanelActive(tab === '__wide__')} />
            }
          </div>
        </div>
        )}

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
            filters={filterEdge?.data?.filters}
            label={filterEdge?.data?.label as string | undefined}
            sourceNodeId={filterEdge?.source}
            nodes={nodesWithFirst}
            edges={edges}
            catalog={moduleCatalog}
            onClose={() => setFilterState(null)}
            onSave={(filters, label) => saveEdgeFilter(filterState.edgeId, filters, label)}
          />
        )}
        {outputState && (
          <OutputPanel
            output={outputState.output}
            onClose={() => setOutputState(null)}
          />
        )}
        {dialog}
      </div>
    </NodeRunContext.Provider>
    </EdgeFilterContext.Provider>
    </EdgeDeleteContext.Provider>
    </EdgeAddContext.Provider>
    </StartContext.Provider>
    </CurrentWorkflowContext.Provider>
  )
}

// ── Public export wrapped in ReactFlowProvider ────────────────────────────────

export default function WorkflowCanvasEditor(props: {
  workflow: Workflow
  onClose: () => void
  onSave: (updated: Workflow, closeAfter?: boolean) => void
  // RUN-CONTROL-1: open focused on this (already running) run — the 409 path.
  initialRunId?: string | number | null
}) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
