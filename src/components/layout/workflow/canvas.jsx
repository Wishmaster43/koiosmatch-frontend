/**
 * Workflow canvas pieces — how nodes and edges look/behave on the ReactFlow
 * canvas: the module node, the click-to-add edge, the per-edge filter panel and
 * the node output panel. NODE_TYPES/EDGE_TYPES are the stable maps ReactFlow needs.
 * Extracted from WorkflowCanvasEditor.
 */
import { useState, useContext, useRef } from 'react'
import { Handle, Position, BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react'
import { CheckCircle, Filter, Loader2, Play, Plus, Trash2, X } from 'lucide-react'
import { MODULE_META } from '@/modules/index'
import { NODE_W, NODE_H } from './serialization'
import { OPERATORS } from './constants'
import { EdgeAddContext, EdgeDeleteContext, EdgeFilterContext, NodeRunContext, StartContext } from './contexts'

// ── Custom node ───────────────────────────────────────────────────────────────

const DRAG_TYPE = 'application/x-wf-start'

function ModuleNode({ id, data, selected }) {
  const meta    = MODULE_META[data.type]
  const onRun   = useContext(NodeRunContext)
  const startCtx = useContext(StartContext)
  const [busy, setBusy] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const dragRef = useRef(false)
  if (!meta) return null
  const Icon = meta.Icon

  const handleRun = async (e) => {
    e.stopPropagation()
    setBusy(true)
    await onRun?.(id, data)
    setBusy(false)
  }

  // Accept the START badge being dropped onto this node
  const handleDragOver = (e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    setDropOver(true)
  }
  const handleDragLeave = () => setDropOver(false)
  const handleDrop = (e) => {
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
          title="Sleep om startpunt te verplaatsen"
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
        <Handle type="target" position={Position.Left}
          style={{ width: 10, height: 10, background: 'var(--border)', border: '2px solid white', top: '38%' }} />
      )}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: meta.bg,
          border: data.isRunning ? `3px solid ${meta.color}` : selected ? `3px solid ${meta.color}` : `2px solid ${meta.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: data.isRunning
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
          title="Module uitvoeren"
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
        {/* Output badge */}
        {data.output && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--color-success)', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={9} color="white" />
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', width: NODE_W }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{meta.label}</div>
        {data.output && (
          <div style={{ fontSize: 9, color: 'var(--color-success)', marginTop: 1 }}>
            {Array.isArray(data.output) ? `${data.output.length} records` : 'Klaar'}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right}
        style={{ width: 10, height: 10, background: 'var(--border)', border: '2px solid white', top: '38%' }} />
    </div>
  )
}

// ── Edge filter panel ─────────────────────────────────────────────────────────

export function EdgeFilterPanel({ filters, onClose, onSave }) {
  const [conds, setConds] = useState(filters?.conditions ?? [])
  const [logic, setLogic] = useState(filters?.logic ?? 'AND')

  const addCond = () => setConds(c => [...c, { field: '', operator: '=', value: '' }])
  const delCond = (i) => setConds(c => c.filter((_, j) => j !== i))
  const updCond = (i, key, val) => setConds(c => c.map((row, j) => j === i ? { ...row, [key]: val } : row))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24, width: 520, maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Filter instellen</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {/* AND / OR toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['AND', 'OR'].map(l => (
            <button key={l} onClick={() => setLogic(l)} style={{
              padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: logic === l ? 'var(--color-primary)' : 'var(--border)',
              color: logic === l ? 'white' : 'var(--text-muted)',
            }}>{l}</button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
            {logic === 'AND' ? 'Alle condities moeten kloppen' : 'Minimaal één conditie moet kloppen'}
          </span>
        </div>

        {/* Condities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {conds.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {i > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', width: 28, textAlign: 'center', flexShrink: 0 }}>{logic}</div>
              )}
              {i === 0 && <div style={{ width: 28, flexShrink: 0 }} />}
              <input value={c.field} onChange={e => updCond(i, 'field', e.target.value)}
                placeholder="veld (bijv. status)"
                style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
              <select value={c.operator} onChange={e => updCond(i, 'operator', e.target.value)}
                style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)' }}>
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              {!['is leeg', 'is gevuld'].includes(c.operator) && (
                <input value={c.value} onChange={e => updCond(i, 'value', e.target.value)}
                  placeholder="waarde"
                  style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
              )}
              <button onClick={() => delCond(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 4 }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>

        <button onClick={addCond} style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-primary)',
          background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 8,
          padding: '6px 12px', cursor: 'pointer', marginBottom: 20, width: '100%', justifyContent: 'center',
        }}>
          <Plus size={12} /> Conditie toevoegen
        </button>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)' }}>Annuleren</button>
          <button onClick={() => { onSave({ logic, conditions: conds }); onClose() }}
            style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
            Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}

// ── JSON output viewer ────────────────────────────────────────────────────────

export function OutputPanel({ output, onClose }) {
  const [search, setSearch] = useState('')
  const json = JSON.stringify(output, null, 2)
  const lines = json.split('\n')
  const filtered = search ? lines.filter(l => l.toLowerCase().includes(search.toLowerCase())) : lines

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        background: '#1E1E2E', borderRadius: 14, width: 680, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #2D2D3F' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>Output — {Array.isArray(output) ? `${output.length} records` : 'Response'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken..."
              style={{ padding: '5px 10px', fontSize: 12, background: '#2D2D3F', border: '1px solid #3D3D4F', borderRadius: 6, color: '#E2E8F0', outline: 'none', width: 160 }} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
        </div>
        <pre style={{
          flex: 1, overflowY: 'auto', margin: 0, padding: '16px 20px',
          fontSize: 12, lineHeight: 1.7, color: '#A8D9A8', fontFamily: 'monospace',
        }}>
          {filtered.join('\n')}
        </pre>
      </div>
    </div>
  )
}

// ── Custom edge ───────────────────────────────────────────────────────────────

function AddableEdge({ id, sourceX, sourceY, targetX, targetY, selected, data }) {
  const onAdd    = useContext(EdgeAddContext)
  const onDelete = useContext(EdgeDeleteContext)
  const onFilter = useContext(EdgeFilterContext)
  const [path]   = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const hasFilters = data?.filters?.conditions?.length > 0
  const stroke = hasFilters ? '#7C3AED' : (selected ? 'var(--color-primary)' : 'var(--border)')
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
          {hasFilters && (
            <div style={{ fontSize: 9, background: '#7C3AED', color: 'white', borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>
              {data.filters.conditions.length} filter{data.filters.conditions.length > 1 ? 's' : ''}
            </div>
          )}
          <button onClick={() => onAdd && onAdd(id)} title="Module invoegen"
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <Plus size={11} />
          </button>
          <button onClick={() => onFilter && onFilter(id)} title="Filter instellen"
            style={{ width: 22, height: 22, borderRadius: '50%', background: hasFilters ? '#F3E8FF' : 'var(--surface)', border: `1.5px solid ${hasFilters ? '#7C3AED' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hasFilters ? '#7C3AED' : 'var(--text-muted)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = hasFilters ? '#7C3AED' : 'var(--border)'; e.currentTarget.style.color = hasFilters ? '#7C3AED' : 'var(--text-muted)' }}>
            <Filter size={11} />
          </button>
          <button onClick={() => onDelete && onDelete(id)} title="Verbinding verbreken"
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
