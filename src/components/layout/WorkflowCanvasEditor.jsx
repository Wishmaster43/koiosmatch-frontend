import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  BaseEdge, EdgeLabelRenderer, getStraightPath,
  ReactFlowProvider, Handle, Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  X, Save, Play, Loader2, Plus, Trash2,
  Zap, CheckCircle, AlertCircle, List, Clock, Filter,
} from 'lucide-react'
import { MODULE_META, MODULE_SCHEMAS } from '../../modules/index'

const TRIGGER_OPTIONS = [
  'Dagelijks 07:00','Dagelijks 08:00','Dagelijks 09:00',
  'Dagelijks 10:00','Dagelijks 12:00','Elk uur',
  'Maandag 07:00','Handmatig','Webhook',
]

const uid  = () => 'n_' + Math.random().toString(36).slice(2, 8)
const mkEdge = (src, tgt) => ({ id: `e_${src}_${tgt}`, source: src, target: tgt, type: 'addable' })

// ── Context for edge add callback (avoids re-creating edge objects) ────────────

const EdgeAddContext = createContext(null)

// ── Helpers ───────────────────────────────────────────────────────────────────

const NODE_W = 90
const NODE_H = 110

function stepsToFlow(steps) {
  const GAP = 220
  const nodes = steps.map((s, i) => ({
    id:       s.id,
    type:     'module',
    position: s.position ?? { x: 80 + i * GAP, y: 180 },
    data:     { type: s.type, config: { ...s.config }, isFirst: i === 0 },
    width:    NODE_W,
    height:   NODE_H,
  }))
  const edges = steps.slice(0, -1).map((s, i) => mkEdge(s.id, steps[i + 1].id))
  return { nodes, edges }
}

function flowToSteps(nodes, edges) {
  const adj     = {}
  edges.forEach(e => { adj[e.source] = e.target })
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
  const starts  = nodes.filter(n => !edges.some(e => e.target === n.id))
  const ordered = []
  let cur = starts[0]
  while (cur) {
    ordered.push(cur)
    cur = adj[cur.id] ? nodeMap[adj[cur.id]] : null
  }
  nodes.forEach(n => { if (!ordered.find(o => o.id === n.id)) ordered.push(n) })
  return ordered.map(n => ({ id: n.id, type: n.data.type, config: n.data.config, position: n.position }))
}

// ── Field renderer ────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <button type="button" onClick={() => onChange(field.key, !value)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ position: 'relative', width: 32, height: 17, borderRadius: 999, background: value ? 'var(--color-primary)' : '#D1D5DB', flexShrink: 0, transition: 'background 0.2s' }}>
          <div style={{ position: 'absolute', top: 2, left: value ? 17 : 2, width: 13, height: 13, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{value ? 'Aan' : 'Uit'}</span>
      </button>
    )
  }
  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {field.options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button key={opt} type="button"
              onClick={() => onChange(field.key, active ? selected.filter(v => v !== opt) : [...selected, opt])}
              style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 12,
                background: active ? 'var(--color-primary-bg)' : '#F9FAFB',
                color:      active ? 'var(--color-primary)'    : '#6B7280',
                border:     `1px solid ${active ? '#C4C0F0' : '#E5E7EB'}`,
                cursor: 'pointer',
              }}>
              {opt}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={e => onChange(field.key, e.target.value)}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', fontSize: 13, color: '#111', outline: 'none' }}>
        <option value="">Selecteer...</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <input type={field.type === 'number' ? 'number' : 'text'}
      value={value || ''}
      placeholder={field.placeholder || ''}
      onChange={e => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
      style={{ width: '100%', padding: '7px 9px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#111', background: 'white', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
      onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
  )
}

// ── Contexts ──────────────────────────────────────────────────────────────────
const EdgeDeleteContext  = createContext(null)
const EdgeFilterContext  = createContext(null)
const NodeRunContext     = createContext(null)

// ── Custom node ───────────────────────────────────────────────────────────────

function ModuleNode({ id, data, selected }) {
  const meta    = MODULE_META[data.type]
  const onRun   = useContext(NodeRunContext)
  const [busy, setBusy] = useState(false)
  if (!meta) return null
  const Icon = meta.Icon

  const handleRun = async (e) => {
    e.stopPropagation()
    setBusy(true)
    await onRun?.(id, data)
    setBusy(false)
  }

  return (
    <div style={{ width: NODE_W, height: NODE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, userSelect: 'none', position: 'relative' }}>
      {data.isFirst && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-primary)', color: 'white',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
        }}>
          START
        </div>
      )}
      {!data.isFirst && (
        <Handle type="target" position={Position.Left}
          style={{ width: 10, height: 10, background: '#D1D5DB', border: '2px solid white', top: '38%' }} />
      )}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: meta.bg,
          border: selected ? `3px solid ${meta.color}` : `2px solid ${meta.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: selected ? `0 0 0 4px ${meta.color}20` : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'border 0.15s, box-shadow 0.15s',
          cursor: 'pointer', flexShrink: 0,
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
            background: busy ? '#E5E7EB' : 'white',
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
            background: '#16A34A', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={9} color="white" />
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', width: NODE_W }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{meta.label}</div>
        {data.output && (
          <div style={{ fontSize: 9, color: '#16A34A', marginTop: 1 }}>
            {Array.isArray(data.output) ? `${data.output.length} records` : 'Klaar'}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right}
        style={{ width: 10, height: 10, background: '#D1D5DB', border: '2px solid white', top: '38%' }} />
    </div>
  )
}

// ── Edge filter panel ─────────────────────────────────────────────────────────

const OPERATORS = ['=', '≠', '>', '<', '≥', '≤', 'bevat', 'bevat niet', 'is leeg', 'is gevuld']

function EdgeFilterPanel({ edgeId, filters, onClose, onSave }) {
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
        background: 'white', borderRadius: 14, padding: 24, width: 520, maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Filter instellen</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
        </div>

        {/* AND / OR toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['AND', 'OR'].map(l => (
            <button key={l} onClick={() => setLogic(l)} style={{
              padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: logic === l ? 'var(--color-primary)' : '#F3F4F6',
              color: logic === l ? 'white' : '#6B7280',
            }}>{l}</button>
          ))}
          <span style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center', marginLeft: 4 }}>
            {logic === 'AND' ? 'Alle condities moeten kloppen' : 'Minimaal één conditie moet kloppen'}
          </span>
        </div>

        {/* Condities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {conds.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {i > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', width: 28, textAlign: 'center', flexShrink: 0 }}>{logic}</div>
              )}
              {i === 0 && <div style={{ width: 28, flexShrink: 0 }} />}
              <input value={c.field} onChange={e => updCond(i, 'field', e.target.value)}
                placeholder="veld (bijv. status)"
                style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none' }} />
              <select value={c.operator} onChange={e => updCond(i, 'operator', e.target.value)}
                style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none', background: 'white' }}>
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              {!['is leeg', 'is gevuld'].includes(c.operator) && (
                <input value={c.value} onChange={e => updCond(i, 'value', e.target.value)}
                  placeholder="waarde"
                  style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none' }} />
              )}
              <button onClick={() => delCond(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><Trash2 size={12} /></button>
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
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer', color: '#6B7280' }}>Annuleren</button>
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

function OutputPanel({ nodeId, output, onClose }) {
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
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={16} /></button>
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
  const stroke = hasFilters ? '#7C3AED' : (selected ? 'var(--color-primary)' : '#D1D5DB')
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
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', border: '1.5px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF' }}>
            <Plus size={11} />
          </button>
          <button onClick={() => onFilter && onFilter(id)} title="Filter instellen"
            style={{ width: 22, height: 22, borderRadius: '50%', background: hasFilters ? '#F3E8FF' : 'white', border: `1.5px solid ${hasFilters ? '#7C3AED' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hasFilters ? '#7C3AED' : '#9CA3AF', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = hasFilters ? '#7C3AED' : '#D1D5DB'; e.currentTarget.style.color = hasFilters ? '#7C3AED' : '#9CA3AF' }}>
            <Filter size={11} />
          </button>
          <button onClick={() => onDelete && onDelete(id)} title="Verbinding verbreken"
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', border: '1.5px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#DC2626' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF' }}>
            <X size={11} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

// nodeTypes/edgeTypes must be stable (module-level) to prevent React Flow remounts
const NODE_TYPES = { module: ModuleNode }
const EDGE_TYPES = { addable: AddableEdge }

// ── Module picker ─────────────────────────────────────────────────────────────

function ModulePicker({ insertAfterEdgeId, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = Object.entries(MODULE_META).filter(([, m]) =>
    m.label.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}>
      <div style={{ width: 320, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Module kiezen</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }} />
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {filtered.map(([type, meta]) => {
            const Icon = meta.Icon
            return (
              <button key={type} type="button"
                onClick={() => { onSelect(type, insertAfterEdgeId); onClose() }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={meta.color} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{meta.label}</span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Geen modules gevonden</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Config panel ──────────────────────────────────────────────────────────────

function ConfigPanel({ node, onUpdate, onDelete }) {
  if (!node) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={20} color="#D1D5DB" />
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>Klik op een module<br />om de configuratie te zien</p>
      </div>
    )
  }
  const meta   = MODULE_META[node.data.type]
  const schema = MODULE_SCHEMAS[node.data.type] || []
  const Icon   = meta?.Icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icon && <Icon size={16} color={meta?.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{meta?.label}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Configuratie</div>
        </div>
        <button onClick={() => onDelete(node.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 4, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
          title="Module verwijderen">
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {schema.map(field => (
          <div key={field.key}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {field.label}
            </label>
            <FieldInput field={field} value={node.data.config[field.key]}
              onChange={(key, val) => onUpdate(node.id, key, val)} />
          </div>
        ))}
        {schema.length === 0 && (
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>Geen configuratie vereist.</p>
        )}
      </div>
    </div>
  )
}

// ── Logs panel ────────────────────────────────────────────────────────────────

const MOCK_LOGS = [
  { id: 1, ts: 'Vandaag 08:00',    ok: true,  candidates: 87, duration: '3.2s', steps_ok: 4 },
  { id: 2, ts: 'Gisteren 08:00',   ok: true,  candidates: 92, duration: '2.8s', steps_ok: 4 },
  { id: 3, ts: '10 jun 08:00',     ok: false, candidates: 0,  duration: '0.9s', error: 'API timeout bij Diensten Ophalen' },
  { id: 4, ts: '9 jun 08:00',      ok: true,  candidates: 78, duration: '3.5s', steps_ok: 4 },
  { id: 5, ts: '8 jun 08:00',      ok: true,  candidates: 64, duration: '2.1s', steps_ok: 4 },
]

function LogsPanel({ onClose }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <List size={14} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Uitvoeringslog</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {MOCK_LOGS.map(log => (
          <div key={log.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F9FAFB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {log.ok
                  ? <CheckCircle size={13} color="#16A34A" />
                  : <AlertCircle size={13} color="#DC2626" />
                }
                <span style={{ fontSize: 12, fontWeight: 500, color: log.ok ? '#16A34A' : '#DC2626' }}>
                  {log.ok ? 'Geslaagd' : 'Mislukt'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{log.ts}</span>
            </div>
            {log.ok
              ? <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6B7280' }}>
                  <span>{log.candidates} kandidaten</span>
                  <span>·</span>
                  <span>{log.duration}</span>
                </div>
              : <div style={{ fontSize: 11, color: '#DC2626' }}>{log.error}</div>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inner editor ──────────────────────────────────────────────────────────────

function EditorInner({ workflow, onClose, onSave }) {
  const initFlow = stepsToFlow(
    (workflow.steps || []).map(s => ({ ...s, id: s.id || uid() }))
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Defer edges until after nodes are mounted so handles exist in the DOM
  useEffect(() => {
    setEdges(initFlow.edges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [name,       setName]      = useState(workflow.name)
  const [trigger,    setTrigger]   = useState(workflow.trigger)
  const [webhookId,  setWebhookId] = useState(workflow.trigger_config?.webhook_id ?? null)
  const [webhooks,   setWebhooks]  = useState([])
  const [status,     setStatus]    = useState(workflow.status || 'draft')
  const [saved,      setSaved]     = useState(false)
  const [running,    setRunning]   = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [pickerState,    setPickerState]    = useState(null)

  useEffect(() => {
    import('../../lib/api').then(m => {
      m.default.get('/webhooks')
        .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
        .catch(() => {})
    })
  }, [])
  const [showLogs,       setShowLogs]       = useState(false)
  const [filterState,    setFilterState]    = useState(null)  // { edgeId }
  const [outputState,    setOutputState]    = useState(null)  // { nodeId, output }

  // Stable callback passed via context — never touches edge objects
  const handleEdgeAdd = useCallback((edgeId) => {
    setPickerState({ edgeId })
  }, [])

  const handleEdgeDelete = useCallback((edgeId) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId))
  }, [setEdges])

  const handleEdgeFilter = useCallback((edgeId) => {
    setFilterState({ edgeId })
  }, [])

  const saveEdgeFilter = useCallback((edgeId, filters) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, filters } } : e))
  }, [setEdges])

  const handleNodeRun = useCallback(async (nodeId, data) => {
    const { default: api } = await import('../../lib/api')
    let output = null

    try {
      if (data.type === 'candidates_fetch' || data.type === 'candidate_filter') {
        const cfg = data.config ?? {}
        const params = { per_page: cfg.limit ?? 100 }
        if (cfg.status && cfg.status !== 'alle') params.status = cfg.status
        const res = await api.get('/candidates', { params })
        let rows = res.data?.data ?? res.data ?? []

        // Client-side filter op pools en features (backend filtert hier nog niet op)
        if (cfg.pools?.length)    rows = rows.filter(c => cfg.pools.some(p => (c.pools ?? []).includes(p)))
        if (cfg.features?.length) rows = rows.filter(c => cfg.features.some(f => (c.features ?? []).includes(f)))
        if (cfg.order_by === 'naam') rows = [...rows].sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`))

        output = rows.slice(0, cfg.limit ?? 100)

      } else if (data.type === 'shift_fetcher') {
        const cfg = data.config ?? {}
        const res = await api.get('/shifts', { params: { per_page: 100 } }).catch(() => null)
        output = res?.data?.data ?? res?.data ?? []

      } else {
        // Generieke test-module call (backend mag dit implementeren)
        const res = await api.post('/workflows/test-module', { module_type: data.type, config: data.config })
        output = res.data?.output ?? res.data
      }
    } catch (err) {
      output = { error: err.response?.data?.message ?? err.message }
    }

    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, output } } : n))
    setOutputState({ nodeId, output })
  }, [setNodes])

  const onConnect = useCallback((params) => {
    setEdges(eds => {
      const targetAlreadyHasIncoming = eds.some(e => e.target === params.target)
      if (!targetAlreadyHasIncoming) {
        return addEdge({ ...params, type: 'addable' }, eds)
      }

      // Target already has an incoming edge → insert a router between them
      const routerId = uid()
      const existingIncoming = eds.filter(e => e.target === params.target)
      const otherEdges = eds.filter(e => e.target !== params.target)

      const newEdges = [
        ...otherEdges,
        // All previous sources now connect to router
        ...existingIncoming.map(e => mkEdge(e.source, routerId)),
        // New source also connects to router
        mkEdge(params.source, routerId),
        // Router connects to original target
        mkEdge(routerId, params.target),
      ]

      // Add router node at midpoint
      setNodes(nds => {
        const targetNode = nds.find(n => n.id === params.target)
        const sourceNode = nds.find(n => n.id === params.source)
        const x = targetNode ? targetNode.position.x - 220 : (sourceNode?.position.x ?? 300) + 220
        const y = targetNode ? targetNode.position.y : (sourceNode?.position.y ?? 180)
        const routerNode = {
          id: routerId, type: 'module',
          position: { x, y },
          data: { type: 'router', config: {} },
          width: NODE_W, height: NODE_H,
        }
        return [...nds, routerNode]
      })

      return newEdges
    })
  }, [setEdges, setNodes])

  const insertModule = useCallback((type, edgeId) => {
    const newId = uid()
    // Read current state snapshots to avoid stale closures
    setNodes(nds => {
      const lastNode = nds[nds.length - 1]
      if (edgeId) {
        // We need edges here — defer edge manipulation to separate call
        return nds
      }
      const x = lastNode ? lastNode.position.x + 220 : 80
      const y = lastNode ? lastNode.position.y : 180
      return [...nds, { id: newId, type: 'module', position: { x, y }, width: NODE_W, height: NODE_H, data: { type, config: {} } }]
    })

    if (edgeId) {
      // Batch node + edge update together using flushSync equivalent — just do them sequentially
      setEdges(eds => {
        const edge = eds.find(e => e.id === edgeId)
        if (!edge) return eds
        return [
          ...eds.filter(e => e.id !== edgeId),
          mkEdge(edge.source, newId),
          mkEdge(newId, edge.target),
        ]
      })
      setNodes(nds => {
        const edge    = edges.find(e => e.id === edgeId)
        if (!edge) return nds
        const srcNode = nds.find(n => n.id === edge.source)
        const tgtNode = nds.find(n => n.id === edge.target)
        const midX    = srcNode && tgtNode ? (srcNode.position.x + tgtNode.position.x) / 2 : 300
        const midY    = srcNode ? srcNode.position.y : 180
        return [
          ...nds.map(n =>
            n.position.x > (srcNode?.position.x ?? Infinity) && n.id !== edge.source
              ? { ...n, position: { ...n.position, x: n.position.x + 220 } }
              : n
          ),
          { id: newId, type: 'module', position: { x: midX, y: midY - 120 }, width: NODE_W, height: NODE_H, data: { type, config: {} } },
        ]
      })
    } else {
      setEdges(eds => {
        const nds = nodes  // snapshot via closure — acceptable here since this is user-triggered
        const lastNode = nds[nds.length - 1]
        if (!lastNode) return eds
        return [...eds, mkEdge(lastNode.id, newId)]
      })
    }

    setSelectedNodeId(newId)
  }, [setNodes, setEdges, edges, nodes])

  const updateNodeConfig = useCallback((nodeId, key, val) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: val } } } : n
    ))
  }, [setNodes])

  const deleteNode = useCallback((nodeId) => {
    setEdges(eds => {
      const inEdge  = eds.find(e => e.target === nodeId)
      const outEdge = eds.find(e => e.source === nodeId)
      const without = eds.filter(e => e.source !== nodeId && e.target !== nodeId)
      if (inEdge && outEdge) {
        return [...without, mkEdge(inEdge.source, outEdge.target)]
      }
      return without
    })
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setSelectedNodeId(id => id === nodeId ? null : id)
  }, [setEdges, setNodes])

  const handleSave = useCallback(() => {
    const steps = flowToSteps(nodes, edges)
    const triggerConfig = trigger === 'Webhook' && webhookId ? { webhook_id: webhookId } : undefined
    onSave({ ...workflow, name, trigger, trigger_config: triggerConfig, status, steps })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [nodes, edges, workflow, name, trigger, webhookId, status, onSave])

  const handleRun = useCallback(async () => {
    setRunning(true)
    await new Promise(r => setTimeout(r, 2000))
    setRunning(false)
  }, [])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  const firstNodeId = nodes
    .filter(n => !edges.some(e => e.target === n.id))
    .sort((a, b) => a.position.x - b.position.x)[0]?.id

  const nodesWithFirst = nodes.map(n => ({
    ...n,
    data: { ...n.data, isFirst: n.id === firstNodeId },
  }))

  return (
    <EdgeAddContext.Provider value={handleEdgeAdd}>
    <EdgeDeleteContext.Provider value={handleEdgeDelete}>
    <EdgeFilterContext.Provider value={handleEdgeFilter}>
    <NodeRunContext.Provider value={handleNodeRun}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#F5F5F7' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          height: 56, padding: '0 20px', flexShrink: 0,
          background: 'white', borderBottom: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color="var(--color-primary)" />
            </div>
            <input
              value={name} onChange={e => setName(e.target.value)}
              style={{ fontSize: 14, fontWeight: 600, color: '#111827', border: 'none', background: 'transparent', outline: 'none', minWidth: 60, maxWidth: 240 }}
            />
          </div>

          <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color="#9CA3AF" />
            <select value={trigger} onChange={e => { setTrigger(e.target.value); setWebhookId(null) }}
              style={{ fontSize: 12, color: '#374151', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer' }}>
              {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {trigger === 'Webhook' && (
              <select value={webhookId ?? ''} onChange={e => setWebhookId(e.target.value || null)}
                style={{ fontSize: 12, color: '#374151', border: '1px solid #E5E7EB', borderRadius: 6, padding: '2px 6px', background: 'white', outline: 'none', cursor: 'pointer' }}>
                <option value=''>— kies webhook —</option>
                {webhooks.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
            )}
          </div>

          <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

          <button onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
              background: status === 'active' ? '#F0FDF4' : '#F9FAFB',
              color:      status === 'active' ? '#16A34A' : '#9CA3AF',
              border:     `1px solid ${status === 'active' ? '#BBF7D0' : '#E5E7EB'}`,
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? '#16A34A' : '#D1D5DB' }} />
            {status === 'active' ? 'Actief' : 'Inactief'}
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setShowLogs(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: showLogs ? 'var(--color-primary-bg)' : '#F9FAFB',
              color:      showLogs ? 'var(--color-primary)'    : '#6B7280',
              border:     `1px solid ${showLogs ? 'var(--color-primary)' : '#E5E7EB'}`,
              cursor: 'pointer',
            }}>
            <List size={13} />
            Logs
          </button>

          <button onClick={handleRun} disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: running ? '#F3F4F6' : 'var(--color-primary-bg)',
              color:      running ? '#9CA3AF' : 'var(--color-primary)',
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            }}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Bezig...' : 'Uitvoeren'}
          </button>

          <button onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: saved ? '#16A34A' : 'var(--color-primary)',
              color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.2s',
            }}>
            <Save size={13} />
            {saved ? 'Opgeslagen!' : 'Opslaan'}
          </button>

          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
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
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.35 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#E5E7EB" gap={20} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                nodeColor={n => MODULE_META[n.data?.type]?.color ?? '#D1D5DB'}
                nodeStrokeWidth={0}
                style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
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
              Module toevoegen
            </button>
          </div>

          {/* Right panel */}
          <div style={{ width: 280, flexShrink: 0, background: 'white', borderLeft: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {showLogs
              ? <LogsPanel onClose={() => setShowLogs(false)} />
              : <ConfigPanel node={selectedNode} onUpdate={updateNodeConfig} onDelete={deleteNode} />
            }
          </div>
        </div>

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
            edgeId={filterState.edgeId}
            filters={edges.find(e => e.id === filterState.edgeId)?.data?.filters}
            onClose={() => setFilterState(null)}
            onSave={(filters) => saveEdgeFilter(filterState.edgeId, filters)}
          />
        )}
        {outputState && (
          <OutputPanel
            nodeId={outputState.nodeId}
            output={outputState.output}
            onClose={() => setOutputState(null)}
          />
        )}
      </div>
    </NodeRunContext.Provider>
    </EdgeFilterContext.Provider>
    </EdgeDeleteContext.Provider>
    </EdgeAddContext.Provider>
  )
}

// ── Public export wrapped in ReactFlowProvider ────────────────────────────────

export default function WorkflowCanvasEditor(props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
