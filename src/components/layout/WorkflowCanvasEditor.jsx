/**
 * WorkflowCanvasEditor — the visual drag-and-drop workflow builder.
 *
 * Renders the node graph (via @xyflow/react / ReactFlow): the canvas, nodes,
 * connecting edges, minimap and controls. Lets the user add modules from a
 * picker, wire them together, configure each module in a side panel, and
 * save/run the workflow.
 *
 * Main blocks below:
 *   - Schedule helpers      → turn a trigger config into a human-readable label
 *   - Field inputs          → render the right form control per schema field type
 *                             (incl. AgentSelectField which fetches /ai/agents)
 *   - ModulePicker          → lists modules, filtered by which apps are enabled
 *   - Node / edge components → how each block and connection looks on the canvas
 *   - Editor component       → owns state, save/run, and the config side panel
 */
import { useState, useCallback, useEffect, createContext, useContext } from 'react'
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
  ChevronDown, CalendarDays,
} from 'lucide-react'
import { MODULE_META, MODULE_SCHEMAS, MODULE_APP_MAP } from '../../modules/index'
import { useApps } from '../../context/AppsContext'
import { AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab } from '../ai/AIManagementTabs'

// ── Schedule helpers ──────────────────────────────────────────────────────────

const DAYS_NL  = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

function scheduleLabel(trigger, cfg) {
  if (!trigger || trigger === 'Handmatig') return 'Handmatig'
  if (trigger === 'Direct') return 'Direct'
  if (!cfg) return 'Gepland'
  const t = cfg.schedule_type
  if (t === 'interval') {
    const u = cfg.interval_unit === 'hours' ? 'uur' : 'min'
    return `Elke ${cfg.interval_value ?? 1} ${u}`
  }
  const time = cfg.time ?? '08:00'
  if (t === 'daily')   return `Dagelijks ${time}`
  if (t === 'weekly') {
    const d = (cfg.days_of_week ?? [1]).map(i => DAYS_NL[i]).join(', ')
    return `${d} ${time}`
  }
  if (t === 'monthly') return `Dag ${cfg.day_of_month ?? 1} v/d maand ${time}`
  if (t === 'quarterly') return `Elk kwartaal ${time}`
  if (t === 'yearly')  return `Jaarlijks ${MONTHS_NL[(cfg.month ?? 1) - 1]} ${cfg.day_of_month ?? 1} ${time}`
  return 'Gepland'
}

// ── Schedule Modal ────────────────────────────────────────────────────────────

function ScheduleModal({ trigger, scheduleConfig, onSave, onClose }) {
  const [type,     setType]     = useState(trigger === 'Handmatig' ? 'manual' : trigger === 'Direct' ? 'instant' : 'scheduled')
  const [sType,    setSType]    = useState(scheduleConfig?.schedule_type ?? 'daily')
  const [intVal,   setIntVal]   = useState(scheduleConfig?.interval_value ?? 15)
  const [intUnit,  setIntUnit]  = useState(scheduleConfig?.interval_unit  ?? 'minutes')
  const [time,     setTime]     = useState(scheduleConfig?.time ?? '08:00')
  const [times,    setTimes]    = useState(scheduleConfig?.times ?? ['08:00'])
  const [dow,      setDow]      = useState(scheduleConfig?.days_of_week ?? [1, 2, 3, 4, 5])
  const [dom,      setDom]      = useState(scheduleConfig?.day_of_month ?? 1)
  const [month,    setMonth]    = useState(scheduleConfig?.month ?? 1)
  const toggleDay = d => setDow(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort((a,b)=>a-b))

  const addTime    = () => setTimes(ts => [...ts, '08:00'])
  const removeTime = i  => setTimes(ts => ts.filter((_, j) => j !== i))
  const updateTime = (i, v) => setTimes(ts => ts.map((t, j) => j === i ? v : t))

  const handleSave = () => {
    if (type === 'manual')  { onSave('Handmatig', null); return }
    if (type === 'instant') { onSave('Direct', null); return }
    const cfg = { schedule_type: sType }
    if (sType === 'interval') { cfg.interval_value = +intVal; cfg.interval_unit = intUnit }
    else if (sType === 'daily')     { cfg.times = times }
    else if (sType === 'weekly')    { cfg.days_of_week = dow; cfg.time = time }
    else if (sType === 'monthly')   { cfg.day_of_month = +dom; cfg.time = time }
    else if (sType === 'quarterly') { cfg.time = time }
    else if (sType === 'yearly')    { cfg.day_of_month = +dom; cfg.month = +month; cfg.time = time }
    onSave('Scheduled', cfg)
  }

  const inputStyle = { padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white', color: '#374151' }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div style={{ width: 480, background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Planning instellen</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Trigger type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { id: 'manual',    label: 'Handmatig', desc: 'Starten via de knop',          Icon: Play },
              { id: 'instant',   label: 'Direct',    desc: 'Zodra data binnenkomt',         Icon: Zap },
              { id: 'scheduled', label: 'Gepland',   desc: 'Automatisch op een schema',     Icon: CalendarDays },
            ].map(({ id, label, desc, Icon: Ic }) => (
              <button key={id} type="button" onClick={() => setType(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${type === id ? 'var(--color-primary)' : '#E5E7EB'}`,
                  background: type === id ? 'var(--color-primary-bg)' : 'white',
                }}>
                <Ic size={20} color={type === id ? 'var(--color-primary)' : '#9CA3AF'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: type === id ? 'var(--color-primary)' : '#374151' }}>{label}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>{desc}</span>
              </button>
            ))}
          </div>

          {/* Schedule type */}
          {type === 'scheduled' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Frequentie</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'interval',  label: 'Interval' },
                    { id: 'daily',     label: 'Dagelijks' },
                    { id: 'weekly',    label: 'Wekelijks' },
                    { id: 'monthly',   label: 'Maandelijks' },
                    { id: 'quarterly', label: 'Kwartaal' },
                    { id: 'yearly',    label: 'Jaarlijks' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => setSType(o.id)}
                      style={{
                        padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: sType === o.id ? 600 : 400,
                        border: `1.5px solid ${sType === o.id ? 'var(--color-primary)' : '#E5E7EB'}`,
                        background: sType === o.id ? 'var(--color-primary-bg)' : 'white',
                        color: sType === o.id ? 'var(--color-primary)' : '#374151',
                        cursor: 'pointer',
                      }}>{o.label}</button>
                  ))}
                </div>
              </div>

              {/* Interval */}
              {sType === 'interval' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Elke</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" min={1} max={999} value={intVal} onChange={e => setIntVal(e.target.value)}
                      style={{ ...inputStyle, width: 80 }} />
                    <select value={intUnit} onChange={e => setIntUnit(e.target.value)} style={selectStyle}>
                      <option value="minutes">Minuten</option>
                      <option value="hours">Uren</option>
                    </select>
                  </div>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Min. interval: 1 minuut</p>
                </div>
              )}

              {/* Daily — multiple times */}
              {sType === 'daily' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tijdstippen</label>
                    <button type="button" onClick={addTime}
                      style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Tijdstip toevoegen</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {times.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="time" value={t} onChange={e => updateTime(i, e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        {times.length > 1 && (
                          <button type="button" onClick={() => removeTime(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', display: 'flex', padding: 4 }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly */}
              {sType === 'weekly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Dagen</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {DAYS_NL.map((d, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{
                            width: 38, height: 38, borderRadius: '50%', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1.5px solid ${dow.includes(i) ? 'var(--color-primary)' : '#E5E7EB'}`,
                            background: dow.includes(i) ? 'var(--color-primary)' : 'white',
                            color: dow.includes(i) ? 'white' : '#374151',
                          }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Monthly */}
              {sType === 'monthly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Dag van de maand</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <button key={d} type="button" onClick={() => setDom(d)}
                          style={{
                            width: 34, height: 34, borderRadius: 8, fontSize: 12, fontWeight: dom === d ? 700 : 400, cursor: 'pointer',
                            border: `1.5px solid ${dom === d ? 'var(--color-primary)' : '#E5E7EB'}`,
                            background: dom === d ? 'var(--color-primary)' : 'white',
                            color: dom === d ? 'white' : '#374151',
                          }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Quarterly */}
              {sType === 'quarterly' && (
                <div>
                  <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Wordt uitgevoerd op de eerste dag van elk kwartaal (jan, apr, jul, okt).</p>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                </div>
              )}

              {/* Yearly */}
              {sType === 'yearly' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Maand</label>
                      <select value={month} onChange={e => setMonth(+e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                        {MONTHS_NL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Dag</label>
                      <input type="number" min={1} max={31} value={dom} onChange={e => setDom(+e.target.value)} style={{ ...inputStyle, width: 70 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tijdstip</label>
                      <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Voorbeeld</div>
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  {scheduleLabel('Scheduled', {
                    schedule_type: sType,
                    interval_value: intVal, interval_unit: intUnit,
                    time, times, days_of_week: dow, day_of_month: dom, month,
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#374151' }}>Annuleren</button>
          <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Opslaan</button>
        </div>
      </div>
    </div>
  )
}

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

// ── Agent select field ────────────────────────────────────────────────────────

function AgentSelectField({ value, onChange, fieldKey }) {
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    import('../../lib/api').then(m => m.default.get('/ai/agents'))
      .then(r => setAgents(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return (
    <select value={value || ''} onChange={e => onChange(fieldKey, e.target.value)}
      style={{ width: '100%', padding: '7px 9px', border: '1px solid #E5E7EB', borderRadius: 8,
               background: 'white', fontSize: 13, color: '#111', outline: 'none', cursor: 'pointer' }}>
      <option value="">{loading ? 'Agents ophalen…' : 'Selecteer een agent…'}</option>
      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )
}

// ── FAQ multi-select field ─────────────────────────────────────────────────────

function FaqSelectField({ value, onChange, fieldKey }) {
  const [faqs,    setFaqs]    = useState([])
  const [loading, setLoading] = useState(true)
  const selected = Array.isArray(value) ? value : []

  useEffect(() => {
    import('../../lib/api').then(m => m.default.get('/ai/faqs'))
      .then(r => setFaqs(r.data?.data ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id]
    onChange(fieldKey, next)
  }

  if (loading) return <div style={{ fontSize: 12, color: '#9CA3AF', padding: '4px 0' }}>FAQ's ophalen…</div>
  if (faqs.length === 0) return (
    <div style={{ fontSize: 12, color: '#9CA3AF', padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }}>
      Geen FAQ's gevonden
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px' }}>
      {faqs.map(faq => {
        const active = selected.includes(faq.id)
        return (
          <label key={faq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={() => toggle(faq.id)}
              style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{faq.name ?? faq.title ?? `FAQ ${faq.id}`}</span>
          </label>
        )
      })}
    </div>
  )
}

// ── Response structure builder ─────────────────────────────────────────────────

const RS_TYPES = ['Text', 'Number', 'Boolean', 'Date', 'Array', 'Collection', 'Any']

function ResponseStructureField({ value, onChange, fieldKey }) {
  const items = Array.isArray(value) ? value : []

  const add    = ()        => onChange(fieldKey, [...items, { name: '', type: 'Text' }])
  const remove = (i)       => onChange(fieldKey, items.filter((_, j) => j !== i))
  const update = (i, k, v) => onChange(fieldKey, items.map((item, j) => j === i ? { ...item, [k]: v } : item))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 22px', gap: 4, padding: '0 2px', marginBottom: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item naam</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</div>
          <div />
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 22px', gap: 4, alignItems: 'center' }}>
          <input value={item.name} onChange={e => update(i, 'name', e.target.value)}
            placeholder="item_naam"
            style={{ padding: '5px 7px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none', minWidth: 0 }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
          <select value={item.type} onChange={e => update(i, 'type', e.target.value)}
            style={{ padding: '5px 5px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none', background: 'white', cursor: 'pointer' }}>
            {RS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={() => remove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
            <X size={13} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)',
          background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6,
          padding: '5px 9px', cursor: 'pointer', marginTop: 2 }}>
        <Plus size={10} /> Item toevoegen
      </button>
    </div>
  )
}

// ── Field renderer ────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }) {
  if (field.type === 'agent_select') {
    return <AgentSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'faq_select') {
    return <FaqSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'response_structure') {
    return <ResponseStructureField value={value} onChange={onChange} fieldKey={field.key} />
  }
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
        {(field.options ?? []).map(o => {
          const val = typeof o === 'object' ? o.value : o
          const lbl = typeof o === 'object' ? o.label : o
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    )
  }
  if (field.type === 'textarea') {
    return (
      <textarea value={value || ''} placeholder={field.placeholder || ''}
        onChange={e => onChange(field.key, e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, color: '#111', background: 'white', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
    )
  }
  if (field.type === 'keyvalue') {
    const pairs = Array.isArray(value) ? value : []
    const update = (i, k, v) => onChange(field.key, pairs.map((p, j) => j === i ? { ...p, [k]: v } : p))
    const add    = () => onChange(field.key, [...pairs, { name: '', value: '' }])
    const remove = (i) => onChange(field.key, pairs.filter((_, j) => j !== i))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pairs.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 4 }}>
            <input value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Naam"
              style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none' }} />
            <input value={p.value} onChange={e => update(i, 'value', e.target.value)} placeholder="Waarde"
              style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, outline: 'none' }} />
            <button type="button" onClick={() => remove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0 4px' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={add}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
          <Plus size={10} /> Toevoegen
        </button>
      </div>
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
            background: 'var(--color-success)', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={9} color="white" />
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', width: NODE_W }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{meta.label}</div>
        {data.output && (
          <div style={{ fontSize: 9, color: 'var(--color-success)', marginTop: 1 }}>
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

function EdgeFilterPanel({ filters, onClose, onSave }) {
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

function OutputPanel({ output, onClose }) {
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
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-danger)'; e.currentTarget.style.color = 'var(--color-danger)' }}
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

const CATEGORY_ORDER = ['Alle', 'Triggers', 'Kandidaten', 'Diensten', 'Berichten', 'AI', 'Integraties', 'Flow beheer', 'Tekst & Parsing', 'Foutafhandeling']

function ModulePicker({ insertAfterEdgeId, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [tab,    setTab]    = useState('Alle')
  const { isAppEnabled } = useApps()

  // Filter out modules whose app is not enabled
  const isModuleEnabled = (type) => {
    const req = MODULE_APP_MAP[type]
    if (!req) return true
    const apps = Array.isArray(req) ? req : [req]
    return apps.some(a => isAppEnabled(a))
  }

  const allEntries = Object.entries(MODULE_META).filter(([type]) => isModuleEnabled(type))

  const visible = allEntries.filter(([, m]) => {
    const matchSearch = !search || m.label.toLowerCase().includes(search.toLowerCase())
    const matchTab    = tab === 'Alle' || m.category === tab
    return matchSearch && matchTab
  })

  // Count per category
  const counts = {}
  allEntries.forEach(([, m]) => {
    const c = m.category ?? 'Overig'
    counts[c] = (counts[c] ?? 0) + 1
  })

  const renderRow = ([type, meta]) => {
    const Icon = meta.Icon
    return (
      <button key={type} type="button"
        onClick={() => { onSelect(type, insertAfterEdgeId); onClose() }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={meta.color} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{meta.label}</div>
        </div>
      </button>
    )
  }

  // In "Alle" tab (or search), render with category dividers
  const renderGrouped = () => {
    const groups = {}
    visible.forEach(entry => {
      const cat = entry[1].category ?? 'Overig'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(entry)
    })
    const orderedCats = CATEGORY_ORDER.filter(c => c !== 'Alle' && groups[c])
    const remaining = Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))
    return [...orderedCats, ...remaining].map((cat, i) => (
      <div key={cat}>
        {i > 0 && <div style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />}
        <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{cat}</div>
        {groups[cat].map(renderRow)}
      </div>
    ))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}>
      <div style={{ width: 400, maxHeight: '82vh', background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header + zoeken */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Module kiezen</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', background: '#F9FAFB', boxSizing: 'border-box', marginBottom: 12 }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #F3F4F6', flexShrink: 0, padding: '0 8px' }}>
          {CATEGORY_ORDER.filter(c => c === 'Alle' || counts[c]).map(cat => (
            <button key={cat} type="button" onClick={() => { setTab(cat); }}
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: tab === cat ? 700 : 400,
                color: tab === cat ? 'var(--color-primary)' : '#6B7280',
                background: 'none', border: 'none', borderBottom: tab === cat ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Lijst */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
          {visible.length === 0 && (
            <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Geen modules gevonden</p>
          )}
          {visible.length > 0 && (tab === 'Alle' || search)
            ? renderGrouped()
            : visible.map(renderRow)
          }
        </div>
      </div>
    </div>
  )
}

// ── Config panel ──────────────────────────────────────────────────────────────

const MANAGE_TABS = ['agents', 'prompts', 'faq', 'knowledge', 'tools']

function ConfigPanel({ node, onUpdate, onDelete, onTabChange }) {
  const [activeTab, setActiveTab] = useState('instellingen')

  const switchTab = (id) => { setActiveTab(id); onTabChange?.(id) }

  // Reset tab when selected node changes
  useEffect(() => { setActiveTab('instellingen'); onTabChange?.('instellingen') }, [node?.id])

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
  const output = node.data.output

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Module header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 0', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icon && <Icon size={16} color={meta?.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.label}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{meta?.category}</div>
        </div>
        <button onClick={() => onDelete(node.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 4, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
          title="Module verwijderen">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', flexShrink: 0, padding: '8px 16px 0', overflowX: 'auto' }}>
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
              color: activeTab === t.id ? 'var(--color-primary)' : '#6B7280',
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
              if (!field.showIf) return true
              return node.data.config[field.showIf.key] === field.showIf.value
            })
            .map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                {field.label}
              </label>
              <FieldInput field={field} value={node.data.config[field.key]}
                onChange={(key, val) => onUpdate(node.id, key, val)} />
              {field.hint && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{field.hint}</div>}
            </div>
          ))}
          {schema.length === 0 && (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Geen configuratie vereist.</p>
          )}
        </div>
      ) : !MANAGE_TABS.includes(activeTab) ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
              <Play size={24} color="#D1D5DB" />
              <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
                Nog geen uitvoerdata.<br />Druk op ▶ bij de module om te testen.
              </p>
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              {Array.isArray(output) && (
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8, fontWeight: 500 }}>
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

// ── Logs panel ────────────────────────────────────────────────────────────────

const MOCK_LOGS = [
  {
    id: 1, ts: 'Vandaag 08:00', ok: true, duration: '3.2s',
    operations: 12, bundles: 87,
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Kandidaten Ophalen',   ok: true,  duration: '1.4s', bundles: 87 },
      { label: 'Filter',               ok: true,  duration: '0.2s', bundles: 64 },
      { label: 'WhatsApp versturen',   ok: true,  duration: '1.5s', bundles: 64 },
    ],
  },
  {
    id: 2, ts: 'Gisteren 08:00', ok: true, duration: '2.8s',
    operations: 9, bundles: 92,
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Kandidaten Ophalen',   ok: true,  duration: '1.2s', bundles: 92 },
      { label: 'Filter',               ok: true,  duration: '0.2s', bundles: 71 },
      { label: 'WhatsApp versturen',   ok: true,  duration: '1.3s', bundles: 71 },
    ],
  },
  {
    id: 3, ts: '10 jun 08:00', ok: false, duration: '0.9s',
    operations: 2, bundles: 0,
    error: 'API timeout bij Diensten Ophalen',
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Diensten Ophalen',     ok: false, duration: '0.8s', bundles: 0, error: 'Request timeout na 800ms' },
    ],
  },
  {
    id: 4, ts: '9 jun 08:00', ok: true, duration: '3.5s',
    operations: 11, bundles: 78,
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Kandidaten Ophalen',   ok: true,  duration: '1.6s', bundles: 78 },
      { label: 'Filter',               ok: true,  duration: '0.3s', bundles: 55 },
      { label: 'WhatsApp versturen',   ok: true,  duration: '1.5s', bundles: 55 },
    ],
  },
]

function LogsPanel({ onClose }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <List size={14} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Uitvoeringen</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {/* Log list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {MOCK_LOGS.map(log => {
          const isOpen = expanded === log.id
          return (
            <div key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              {/* Row */}
              <button type="button"
                onClick={() => setExpanded(isOpen ? null : log.id)}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', gap: 8, textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {log.ok
                  ? <CheckCircle size={13} color="var(--color-success)" style={{ flexShrink: 0 }} />
                  : <AlertCircle size={13} color="var(--color-danger)" style={{ flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: log.ok ? '#111827' : 'var(--color-danger)' }}>
                      {log.ok ? 'Geslaagd' : 'Mislukt'}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{log.duration}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {log.ts} · {log.operations} operaties · {log.bundles} bundles
                  </div>
                  {!log.ok && log.error && (
                    <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2 }}>{log.error}</div>
                  )}
                </div>
                <ChevronDown size={12} color="#D1D5DB"
                  style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {/* Expanded steps */}
              {isOpen && (
                <div style={{ padding: '0 16px 12px 36px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {log.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.ok ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{step.label}</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{step.duration}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>
                          {step.ok ? `${step.bundles} bundles` : step.error}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
  const [name,           setName]           = useState(workflow.name)
  const [trigger,        setTrigger]        = useState(workflow.trigger)
  const [scheduleConfig, setScheduleConfig] = useState(workflow.trigger_config?.schedule ?? null)
  const [webhookId]                         = useState(workflow.trigger_config?.webhook_id ?? null)
  const [, setWebhooks]                      = useState([])
  const [status,         setStatus]         = useState(workflow.status || 'draft')
  const [saved,          setSaved]          = useState(false)
  const [running,        setRunning]        = useState(false)
  const [runningNodeId,  setRunningNodeId]  = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [pickerState,    setPickerState]    = useState(null)
  const [showSchedule,   setShowSchedule]   = useState(false)
  const [widePanelActive, setWidePanelActive] = useState(false)

  useEffect(() => {
    import('../../lib/api').then(m => {
      m.default.get('/webhooks')
        .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
        .catch(() => {})
    })
  }, [])
  const [showLogs,       setShowLogs]       = useState(false)
  const [filterState,    setFilterState]    = useState(null)
  const [outputState,    setOutputState]    = useState(null)

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
        // ShiftManager-sync (oude shape: firstname/pools/features) → /sm/candidates,
        // dat de oorspronkelijke Nederlandse status-waarden gebruikt (geen remap).
        if (cfg.status && cfg.status !== 'alle') params.status = cfg.status
        const res = await api.get('/sm/candidates', { params })
        let rows = res.data?.data ?? res.data ?? []

        // Client-side filter op pools en features (backend filtert hier nog niet op)
        if (cfg.pools?.length)    rows = rows.filter(c => cfg.pools.some(p => (c.pools ?? []).includes(p)))
        if (cfg.features?.length) rows = rows.filter(c => cfg.features.some(f => (c.features ?? []).includes(f)))
        if (cfg.order_by === 'naam') rows = [...rows].sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`))

        output = rows.slice(0, cfg.limit ?? 100)

      } else if (data.type === 'shift_fetcher') {
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
    let triggerConfig = undefined
    if (trigger === 'Webhook' && webhookId) triggerConfig = { webhook_id: webhookId }
    else if (trigger === 'Scheduled' && scheduleConfig) triggerConfig = { schedule: scheduleConfig }
    onSave({ ...workflow, name, trigger, trigger_config: triggerConfig, status, steps })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [nodes, edges, workflow, name, trigger, scheduleConfig, webhookId, status, onSave])

  const handleRun = useCallback(async () => {
    setRunning(true)
    // Walk nodes in flow order, animate each
    const orderedNodes = []
    const visited = new Set()
    const startId = nodes.filter(n => !edges.some(e => e.target === n.id))
                         .sort((a, b) => a.position.x - b.position.x)[0]?.id
    let current = startId
    while (current && !visited.has(current)) {
      orderedNodes.push(current)
      visited.add(current)
      current = edges.find(e => e.source === current)?.target
    }
    for (const nid of orderedNodes) {
      setRunningNodeId(nid)
      await new Promise(r => setTimeout(r, 800))
    }
    setRunningNodeId(null)
    setRunning(false)
  }, [nodes, edges])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  const firstNodeId = nodes
    .filter(n => !edges.some(e => e.target === n.id))
    .sort((a, b) => a.position.x - b.position.x)[0]?.id

  const nodesWithFirst = nodes.map(n => ({
    ...n,
    data: { ...n.data, isFirst: n.id === firstNodeId, isRunning: n.id === runningNodeId },
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

          <button onClick={() => setShowSchedule(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer',
              fontSize: 12, color: '#374151', fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F9FAFB')}>
            <Clock size={13} color="#9CA3AF" />
            {scheduleLabel(trigger, scheduleConfig)}
          </button>

          <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

          <button onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
              background: status === 'active' ? '#F0FDF4' : '#F9FAFB',
              color:      status === 'active' ? 'var(--color-success)' : '#9CA3AF',
              border:     `1px solid ${status === 'active' ? '#BBF7D0' : '#E5E7EB'}`,
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? 'var(--color-success)' : '#D1D5DB' }} />
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
              background: saved ? 'var(--color-success)' : 'var(--color-primary)',
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

          {/* Right panel — widens when management tabs (Agents/Prompts/FAQ/etc.) are active */}
          <div style={{ width: widePanelActive ? 560 : 280, flexShrink: 0, background: 'white', borderLeft: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s ease' }}>
            {showLogs
              ? <LogsPanel onClose={() => setShowLogs(false)} />
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
