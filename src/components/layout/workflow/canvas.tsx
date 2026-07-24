/**
 * Workflow canvas pieces — how nodes and edges look/behave on the ReactFlow
 * canvas: the module node, the click-to-add edge, and the node output panel.
 * NODE_TYPES/EDGE_TYPES are the stable maps ReactFlow needs. Extracted from
 * WorkflowCanvasEditor. The per-edge filter panel lives in its own file,
 * EdgeFilterPanel.tsx, next to this one.
 */
import { useState, useContext, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { MouseEvent, DragEvent } from 'react'
import { Handle, Position, BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react'
import { CheckCircle, Filter, HelpCircle, Loader2, Play, Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MODULE_META } from '@/modules/index'
import { NODE_W, NODE_H, countEdgeFilterConditions } from './serialization'
import { EdgeAddContext, EdgeDeleteContext, EdgeFilterContext, NodeRunContext, StartContext } from './contexts'
import OutputTree from './OutputTree'
import type { FlowNodeData, EdgeFilters } from '@/types/workflow'

// ── Custom node ───────────────────────────────────────────────────────────────

const DRAG_TYPE = 'application/x-wf-start'

function ModuleNode({ id, data, selected }: { id: string; data: FlowNodeData; selected?: boolean }) {
  const onRun   = useContext(NodeRunContext)
  const startCtx = useContext(StartContext)
  const [busy, setBusy] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const dragRef = useRef(false)
  const { t } = useTranslation('workflows')
  // Unknown module type → grey fallback node, NEVER null: an unrendered node has
  // no handles, so ReactFlow drops every touching edge (the error#008 spam) and
  // the step becomes invisible/uneditable.
  const meta = (data.type ? MODULE_META[data.type] : undefined)
    // eslint-disable-next-line no-restricted-syntax -- DATA: mirrors the module registry's colour/bg swatch shape (src/modules/*.ts), a fixed neutral for an unrecognised module type, not a themeable UI colour
    ?? { label: data.type ?? 'Onbekend', Icon: HelpCircle, color: '#64748B', bg: '#F1F5F9', category: 'Onbekend' }
  // The registry types Icon narrowly (size only); lucide icons also take `color`.
  const Icon = meta.Icon as unknown as LucideIcon
  // WF-R3 live per-step status → node ring + badge colour.
  const status = data.status as string | undefined
  const failed = status === 'failed'
  const done   = status === 'success'

  // NODE-PROGRESS-1 (Danny 23-07 "een rondje hoever hij is met lopen", Make-style):
  // a circular progress arc IN the glow ring + a counter badge. Determinate when the
  // step reports {done,total} loop progress; an indeterminate spinner otherwise. The
  // arc also keeps filling after step-success while a fan-out is still delivering.
  const progress = data.progress as { done: number; total: number } | null | undefined
  const itemsTotal = data.itemsTotal as number | null | undefined
  const frac = progress && progress.total > 0 ? Math.min(1, progress.done / progress.total) : null
  // A QUEUED step during a live run spins a muted arc too (Danny 24-07 "geen glow
  // geen cirkel" — his screenshot caught exactly the wachtrij window, which showed
  // nothing). The sub-100% arc may only persist past step-success while the run is
  // still being polled (a delivering fan-out): once the run is terminal the poll
  // stops, so a partial ring would freeze forever — then only the badge remains.
  const queued = status === 'pending' && Boolean(data.runActive)
  const arcActive = !failed && (Boolean(data.isRunning) || queued || (frac != null && frac < 1 && Boolean(data.runActive)))
  // Live counter while looping; the processed total (Make's "38") once finished.
  const badgeCount = arcActive
    ? (progress?.done ?? null)
    : (done ? (itemsTotal ?? progress?.total ?? null) : null)
  const ARC_R = 39
  const ARC_C = 2 * Math.PI * ARC_R

  const handleRun = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setBusy(true)
    await onRun?.(id, data)
    setBusy(false)
  }

  // Accept the START badge being dropped onto this node
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    setDropOver(true)
  }
  const handleDragLeave = () => setDropOver(false)
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    setDropOver(false)
    startCtx?.setStartNodeId(id)
  }

  return (
    <div
      style={{ width: NODE_W, height: NODE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, userSelect: 'none', position: 'relative' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop indicator ring */}
      {dropOver && (
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2.5px dashed var(--color-primary)', pointerEvents: 'none', zIndex: 10 }} />
      )}
      {data.isFirst && (
        <div
          draggable
          className="nodrag"
          onMouseDown={e => e.stopPropagation()}
          onDragStart={(e) => {
            dragRef.current = true
            e.dataTransfer.setData(DRAG_TYPE, id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => { dragRef.current = false }}
          title={t('canvas.dragStart')} aria-label={t('canvas.dragStart')}
          style={{
            position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--color-primary)', color: 'white',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
            padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
            cursor: 'grab', zIndex: 5,
          }}
        >
          ▶ START
        </div>
      )}
      {!data.isFirst && (
        <Handle type="target" id="in" position={Position.Left}
          style={{ width: 10, height: 10, background: 'var(--border)', border: '2px solid white', top: '38%' }} />
      )}
      <div style={{ position: 'relative' }}>
        {/* NODE-PROGRESS-1: the progress arc, drawn exactly on the glow ring. Determinate
            (filled fraction, smooth) with loop progress; an indeterminate spinner without. */}
        {arcActive && (
          <svg width={84} height={84} viewBox="0 0 84 84" aria-hidden
            style={{ position: 'absolute', top: -6, left: -6, pointerEvents: 'none', zIndex: 3,
                     transformOrigin: '50% 50%',
                     animation: frac == null ? 'spin 1s linear infinite' : 'none' }}>
            {/* Faint full-circle track so the remaining part of the ring stays visible. */}
            {frac != null && (
              <circle cx={42} cy={42} r={ARC_R} fill="none" stroke={meta.color} strokeOpacity={0.18} strokeWidth={4} />
            )}
            {/* Queued (not yet running) spins muted; a live step spins full-colour. */}
            <circle cx={42} cy={42} r={ARC_R} fill="none" stroke={meta.color} strokeWidth={4}
              strokeOpacity={queued && frac == null ? 0.4 : 1}
              strokeLinecap="round" strokeDasharray={ARC_C}
              strokeDashoffset={frac == null ? ARC_C * 0.75 : ARC_C * (1 - frac)}
              transform="rotate(-90 42 42)"
              style={{ transition: frac != null ? 'stroke-dashoffset 0.4s ease' : 'none' }} />
          </svg>
        )}
        {/* NODE-PROGRESS-1: Make-style counter badge — live count while looping, the
            processed total after success. Top-LEFT (Danny 24-07 "getal niet goed te
            lezen"): the first node's draggable START pill owns the top-right area,
            so the counter sits left where it never collides, on any node. */}
        {badgeCount != null && (
          <span style={{ position: 'absolute', top: -9, left: -9, zIndex: 4,
                         minWidth: 16, padding: '2px 6px', borderRadius: 999,
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: meta.color, color: 'white', fontSize: 10, fontWeight: 700,
                         fontFamily: "'JetBrains Mono', monospace", lineHeight: '14px',
                         border: '2px solid var(--surface)', whiteSpace: 'nowrap' }}>
            {badgeCount}
          </span>
        )}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: meta.bg,
          border: failed ? '3px solid var(--color-danger)' : done ? '3px solid var(--color-success)'
            : data.isRunning ? `3px solid ${meta.color}` : selected ? `3px solid ${meta.color}` : `2px solid ${meta.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: failed ? '0 0 0 4px var(--color-danger-bg)' : done ? '0 0 0 4px var(--color-success-bg)'
            : data.isRunning
            ? `0 0 0 6px ${meta.color}30, 0 0 20px ${meta.color}50`
            : selected ? `0 0 0 4px ${meta.color}20` : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'border 0.2s, box-shadow 0.2s',
          cursor: 'pointer', flexShrink: 0,
          animation: data.isRunning ? 'nodePulse 1s ease-in-out infinite' : 'none',
        }}>
          <Icon size={26} color={meta.color} />
        </div>
        {/* Run knop rechtsonder op de cirkel */}
        <button
          onClick={handleRun}
          title={t('canvas.runModule')} aria-label={t('canvas.runModule')}
          style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 22, height: 22, borderRadius: '50%',
            background: busy ? 'var(--border)' : 'var(--surface)',
            border: `1.5px solid ${meta.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: meta.color,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
        </button>
        {/* Status badge — live run (success/failed) or a stored test-run output.
            Suppressed while the counter badge occupies the same corner (verify
            finding): the green ring already encodes success; failed always shows
            here since the counter never renders on a failed step. */}
        {badgeCount == null && (done || failed || !!data.output) && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16, borderRadius: '50%',
            background: failed ? 'var(--color-danger)' : 'var(--color-success)', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {failed ? <X size={9} color="white" /> : <CheckCircle size={9} color="white" />}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', width: NODE_W }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{meta.label}</div>
        {!!data.output && (
          <div style={{ fontSize: 9, color: 'var(--color-success)', marginTop: 1 }}>
            {Array.isArray(data.output) ? `${data.output.length} records` : 'Klaar'}
          </div>
        )}
      </div>
      <Handle type="source" id="out" position={Position.Right}
        style={{ width: 10, height: 10, background: 'var(--border)', border: '2px solid white', top: '38%' }} />
    </div>
  )
}

// ── Node output viewer ────────────────────────────────────────────────────────
// Renders a test-run/live-run output as an expandable field tree (OutputTree)
// instead of a raw JSON blob — same viewer the ConfigPanel "Uitvoering" tab uses,
// so a module's output looks identical everywhere it's inspected.

export function OutputPanel({ output, onClose }: { output?: unknown; onClose: () => void }) {
  const { t } = useTranslation('workflows')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('canvas.outputTitle')} tabIndex={-1} style={{
        background: 'var(--surface)', borderRadius: 14, width: 680, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('canvas.outputTitle')} — {Array.isArray(output) ? t('canvas.records', { n: output.length }) : t('canvas.response')}</div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <OutputTree data={output} />
        </div>
      </div>
    </div>
  )
}

// ── Custom edge ───────────────────────────────────────────────────────────────

function AddableEdge({ id, sourceX, sourceY, targetX, targetY, selected, data }: {
  id: string; sourceX: number; sourceY: number; targetX: number; targetY: number
  selected?: boolean; data?: { filters?: EdgeFilters; label?: string }
}) {
  const onAdd    = useContext(EdgeAddContext)
  const onDelete = useContext(EdgeDeleteContext)
  const onFilter = useContext(EdgeFilterContext)
  const { t }    = useTranslation('workflows')
  const [path]   = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  // Counts conditions across BOTH persisted shapes: the legacy flat
  // `{conditions,logic}` object and the newer nested OR-group array.
  const filterCount = countEdgeFilterConditions(data?.filters)
  const hasFilters = filterCount > 0
  const stroke = hasFilters ? 'var(--color-violet)' : (selected ? 'var(--color-primary)' : 'var(--border)')
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth: hasFilters ? 2.5 : 2, strokeDasharray: hasFilters ? '6 3' : undefined }} />
      <EdgeLabelRenderer>
        <div style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
          pointerEvents: 'all',
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          {/* Route name (Router branch) */}
          {data?.label && (
            <div style={{ fontSize: 9, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', borderRadius: 999, padding: '1px 6px', fontWeight: 700, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.label}
            </div>
          )}
          {hasFilters && (
            <div style={{ fontSize: 9, background: 'var(--color-violet)', color: 'white', borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>
              {t('canvas.filterCount', { count: filterCount })}
            </div>
          )}
          <button onClick={() => onAdd && onAdd(id)} title={t('editor.addModule')} aria-label={t('editor.addModule')}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <Plus size={11} />
          </button>
          <button onClick={() => onFilter && onFilter(id)} title={t('canvas.filterTitle')} aria-label={t('canvas.filterTitle')}
            style={{ width: 22, height: 22, borderRadius: '50%', background: hasFilters ? 'var(--color-violet-bg)' : 'var(--surface)', border: `1.5px solid ${hasFilters ? 'var(--color-violet)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hasFilters ? 'var(--color-violet)' : 'var(--text-muted)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-violet)'; e.currentTarget.style.color = 'var(--color-violet)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = hasFilters ? 'var(--color-violet)' : 'var(--border)'; e.currentTarget.style.color = hasFilters ? 'var(--color-violet)' : 'var(--text-muted)' }}>
            <Filter size={11} />
          </button>
          <button onClick={() => onDelete && onDelete(id)} title={t('canvas.deleteEdge')} aria-label={t('canvas.deleteEdge')}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-danger)'; e.currentTarget.style.color = 'var(--color-danger)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <X size={11} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

// nodeTypes/edgeTypes must be stable (module-level) to prevent React Flow remounts
export const NODE_TYPES = { module: ModuleNode }
export const EDGE_TYPES = { addable: AddableEdge }
