import { useState } from 'react'
import { X, Plus, Trash2, ChevronDown, ChevronUp, Save, Zap, GripVertical } from 'lucide-react'
import ScheduleSettings, { scheduleLabel } from '../workflows/ScheduleSettings'
import { MODULE_META, MODULE_SCHEMAS } from '../../modules/index'

const uid = () => 'step_' + Math.random().toString(36).slice(2, 8)

// ── Route module picker ───────────────────────────────────────────────────────

function RouteModulePicker({ onAdd }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs rounded-lg w-full py-1.5 px-2"
        style={{ border: '1px dashed #E5E7EB', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#9CA3AF' }}>
        <Plus size={11} /> Actie toevoegen
      </button>
      {open && (
        <div className="absolute left-0 z-50 overflow-hidden bg-white rounded-xl"
          style={{ top: '100%', marginTop: 4, width: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB' }}>
          {Object.entries(MODULE_META).map(([type, meta]) => {
            const Icon = meta.Icon
            return (
              <button key={type} type="button"
                onClick={() => { onAdd(type); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #F9FAFB' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-md"
                  style={{ width: 24, height: 24, background: meta.bg }}>
                  <Icon size={12} color={meta.color} />
                </div>
                <span className="text-xs font-medium text-gray-700">{meta.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Veld renderers ─────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <button type="button" onClick={() => onChange(field.key, !value)}
        className="flex items-center gap-2 cursor-pointer"
        style={{ background: 'none', border: 'none', padding: 0 }}>
        <div className="relative flex-shrink-0 transition-all duration-200 rounded-full"
          style={{ width: 32, height: 17, background: value ? 'var(--color-primary)' : '#D1D5DB' }}>
          <div className="absolute top-0.5 rounded-full bg-white transition-all duration-200"
            style={{ width: 13, height: 13, left: value ? 17 : 2 }} />
        </div>
        <span className="text-xs text-gray-500">{value ? 'Aan' : 'Uit'}</span>
      </button>
    )
  }

  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="flex flex-wrap gap-1.5">
        {field.options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button key={opt} type="button"
              onClick={() => onChange(field.key, active ? selected.filter(v => v !== opt) : [...selected, opt])}
              className="rounded-full px-2.5 py-1 text-xs transition-all"
              style={{
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
        className="w-full text-sm text-gray-800 rounded-lg"
        style={{ padding: '7px 9px', border: '1px solid #E5E7EB', background: 'white', outline: 'none' }}>
        <option value="">Selecteer...</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (field.type === 'routes') {
    const routes    = Array.isArray(value) ? value : []
    const OPERATORS = ['gelijk aan', 'niet gelijk aan', 'bevat', 'groter dan', 'kleiner dan', 'bestaat']
    const ALL_MODULES = Object.entries(MODULE_META)
    const setRoutes  = (next) => onChange(field.key, next)
    const addRoute   = () => setRoutes([...routes, { name: `Route ${routes.length + 1}`, field: '', operator: 'gelijk aan', value: '', steps: [] }])
    const delRoute   = (i) => setRoutes(routes.filter((_, j) => j !== i))
    const updRoute   = (i, key, val) => setRoutes(routes.map((r, j) => j === i ? { ...r, [key]: val } : r))
    const addStep    = (i, type) => updRoute(i, 'steps', [...(routes[i].steps || []), { id: uid(), type, config: {} }])
    const delStep    = (i, si)   => updRoute(i, 'steps', (routes[i].steps || []).filter((_, j) => j !== si))

    return (
      <div className="flex flex-col gap-3">
        {routes.map((route, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>

            {/* Route header */}
            <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <input
                value={route.name}
                onChange={e => updRoute(i, 'name', e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-transparent outline-none border-none flex-1"
                placeholder={`Route ${i + 1}`}
              />
              <button type="button" onClick={() => delRoute(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-3">
              {/* Conditie */}
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Conditie</div>
                <div className="flex gap-2 flex-wrap">
                  <input value={route.field} onChange={e => updRoute(i, 'field', e.target.value)}
                    placeholder="Veld (bijv. action)"
                    className="text-xs rounded-md"
                    style={{ padding: '5px 8px', border: '1px solid #E5E7EB', outline: 'none', flex: 1, minWidth: 80 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                    onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
                  <select value={route.operator} onChange={e => updRoute(i, 'operator', e.target.value)}
                    className="text-xs rounded-md"
                    style={{ padding: '5px 8px', border: '1px solid #E5E7EB', background: 'white', outline: 'none' }}>
                    {OPERATORS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  {route.operator !== 'bestaat' && (
                    <input value={route.value} onChange={e => updRoute(i, 'value', e.target.value)}
                      placeholder="Waarde (bijv. RESPOND)"
                      className="text-xs rounded-md"
                      style={{ padding: '5px 8px', border: '1px solid #E5E7EB', outline: 'none', flex: 1, minWidth: 80 }}
                      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                      onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
                  )}
                </div>
              </div>

              {/* Stappen van deze route */}
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Acties</div>
                <div className="flex flex-col gap-1.5">
                  {(route.steps || []).map((step, si) => {
                    const meta = MODULE_META[step.type]
                    if (!meta) return null
                    const Icon = meta.Icon
                    return (
                      <div key={step.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                        style={{ background: meta.bg, border: `1px solid ${meta.color}20` }}>
                        <Icon size={12} color={meta.color} />
                        <span className="text-xs font-medium flex-1" style={{ color: meta.color }}>{meta.label}</span>
                        <button type="button" onClick={() => delStep(i, si)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: `${meta.color}60` }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = `${meta.color}60`)}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}

                  {/* Module picker inline */}
                  <RouteModulePicker onAdd={(type) => addStep(i, type)} />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={addRoute}
          className="flex items-center gap-2 text-xs font-medium py-2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}>
          <Plus size={12} /> Route toevoegen
        </button>
      </div>
    )
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value || ''}
      placeholder={field.placeholder || ''}
      onChange={e => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
      className="w-full text-sm text-gray-800 rounded-lg"
      style={{ padding: '7px 9px', border: '1px solid #E5E7EB', background: 'white', outline: 'none' }}
      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
      onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
    />
  )
}

// ── Stap kaart met drag handle ─────────────────────────────────────────────────

function StepCard({ step, index, expanded, onToggle, onUpdate, onDelete, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const meta   = MODULE_META[step.type]
  const schema = MODULE_SCHEMAS[step.type] || []
  if (!meta) return null
  const Icon = meta.Icon

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="overflow-hidden transition-all duration-150 rounded-xl"
      style={{
        border:   isDragOver ? `2px solid var(--color-primary)` : '1px solid #F3F4F6',
        opacity:  isDragging ? 0.4 : 1,
        cursor:   isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 p-3 bg-white"
        style={{ borderBottom: expanded ? '1px solid #F9FAFB' : 'none' }}
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing"
          style={{ color: '#D1D5DB', padding: '2px' }}
          title="Slepen om volgorde te veranderen"
        >
          <GripVertical size={15} />
        </div>

        {/* Icon */}
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-lg"
          style={{ width: 30, height: 30, background: meta.bg }}
        >
          <Icon size={14} color={meta.color} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="font-mono text-xs text-gray-400">stap {index + 1}</div>
          <div className="text-sm font-medium text-gray-800">{meta.label}</div>
        </div>

        {/* Acties */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center justify-center transition-colors rounded-md"
            style={{ width: 26, height: 26, background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
          >
            <Trash2 size={13} />
          </button>
          <div className="cursor-pointer" onClick={onToggle}>
            {expanded ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
          </div>
        </div>
      </div>

      {/* Config velden */}
      {expanded && (
        <div className="flex flex-col gap-3 p-3 bg-gray-50">
          {schema.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                {field.label}
              </label>
              <FieldInput field={field} value={step.config[field.key]}
                onChange={(key, val) => onUpdate(key, val)} />
            </div>
          ))}
          {schema.length === 0 && (
            <p className="text-xs text-gray-400">Geen configuratie vereist.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Module picker ──────────────────────────────────────────────────────────────

function ModulePicker({ onSelect, onClose }) {
  return (
    <div className="overflow-hidden bg-white rounded-xl"
      style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500">Module toevoegen</p>
      </div>
      {Object.entries(MODULE_META).map(([type, meta]) => {
        const Icon = meta.Icon
        return (
          <button key={type} type="button"
            onClick={() => { onSelect(type); onClose() }}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
              style={{ width: 28, height: 28, background: meta.bg }}>
              <Icon size={13} color={meta.color} />
            </div>
            <div className="text-sm font-medium text-gray-700">{meta.label}</div>
          </button>
        )
      })}
    </div>
  )
}

// ── Hoofd editor ───────────────────────────────────────────────────────────────

export default function WorkflowEditor({ workflow, onClose, onSave }) {
  const [name,        setName]        = useState(workflow.name)
  const [trigger,     setTrigger]     = useState(workflow.trigger)
  const [steps,       setSteps]       = useState(
    workflow.steps.map(s => ({ ...s, id: uid(), config: { ...s.config } }))
  )
  const [expandedId,    setExpandedId]    = useState(steps[0]?.id || null)
  const [showPicker,    setShowPicker]    = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [showSchedule,  setShowSchedule]  = useState(false)
  const [schedule,      setSchedule]      = useState(workflow.schedule || null)

  // Drag state
  const [draggedId,   setDraggedId]   = useState(null)
  const [dragOverId,  setDragOverId]  = useState(null)

  // ── Stap acties ───────────────────────────────────────────────────────────────

  const updateStepConfig = (stepId, key, value) =>
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, config: { ...s.config, [key]: value } } : s))

  const deleteStep = (stepId) => {
    setSteps(prev => prev.filter(s => s.id !== stepId))
    if (expandedId === stepId) setExpandedId(null)
  }

  const addStep = (type) => {
    const newStep = { id: uid(), type, config: {} }
    setSteps(prev => [...prev, newStep])
    setExpandedId(newStep.id)
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────────

  const handleDragStart = (id) => {
    setDraggedId(id)
  }

  const handleDragOver = (e, id) => {
    e.preventDefault()
    if (id !== draggedId) setDragOverId(id)
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (draggedId && targetId && draggedId !== targetId) {
      setSteps(prev => {
        const items   = [...prev]
        const fromIdx = items.findIndex(s => s.id === draggedId)
        const toIdx   = items.findIndex(s => s.id === targetId)
        const [moved] = items.splice(fromIdx, 1)
        items.splice(toIdx, 0, moved)
        return items
      })
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    onSave({ ...workflow, name, trigger, schedule, steps })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col overflow-hidden bg-white"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 px-5"
          style={{ height: 56, borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg"
              style={{ width: 28, height: 28, background: 'var(--color-primary-bg)' }}>
              <Zap size={14} color="var(--color-primary)" />
            </div>
            <span className="font-medium text-gray-800" style={{ fontSize: 14 }}>
              Werkstroom bewerken
            </span>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center transition-colors rounded-lg"
            style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 gap-5 p-5 overflow-auto">

          {/* Naam */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Naam</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm font-medium text-gray-800 rounded-lg"
              style={{ padding: '9px 11px', border: '1px solid #E5E7EB', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Inplannen</label>
            <button type="button" onClick={() => setShowSchedule(true)}
              className="flex items-center justify-between w-full text-sm text-gray-800 rounded-lg"
              style={{ padding: '9px 11px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}>
              <div className="flex items-center gap-2">
                <Clock size={13} color="#9CA3AF" />
                <span>{scheduleLabel(schedule)}</span>
              </div>
              <ChevronDown size={14} color="#9CA3AF" />
            </button>
          </div>

          {/* Stappen */}
          <div>
            <label className="block mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
              Stappen ({steps.length}) — sleep om volgorde te wijzigen
            </label>

            <div className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={i}
                  expanded={expandedId === step.id}
                  isDragging={draggedId === step.id}
                  isDragOver={dragOverId === step.id}
                  onToggle={() => setExpandedId(expandedId === step.id ? null : step.id)}
                  onUpdate={(key, val) => updateStepConfig(step.id, key, val)}
                  onDelete={() => deleteStep(step.id)}
                  onDragStart={() => handleDragStart(step.id)}
                  onDragOver={(e) => handleDragOver(e, step.id)}
                  onDrop={(e) => handleDrop(e, step.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}

              {showPicker ? (
                <ModulePicker onSelect={addStep} onClose={() => setShowPicker(false)} />
              ) : (
                <button type="button" onClick={() => setShowPicker(true)}
                  className="flex items-center justify-center w-full gap-2 py-3 text-sm transition-all rounded-xl"
                  style={{ border: '1.5px dashed #E5E7EB', background: 'none', color: '#9CA3AF', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#9CA3AF' }}>
                  <Plus size={15} />
                  Stap toevoegen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between flex-shrink-0 px-5"
          style={{ height: 60, borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 rounded-lg"
            style={{ background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
            Annuleren
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg"
            style={{ background: saved ? '#16A34A' : 'var(--color-primary)', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
            <Save size={14} />
            {saved ? 'Opgeslagen!' : 'Opslaan'}
          </button>
        </div>
      </div>

      {showSchedule && (
        <ScheduleSettings
          value={schedule}
          onChange={setSchedule}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </>
  )
}