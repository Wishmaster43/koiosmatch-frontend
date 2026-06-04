import { useState } from 'react'
import {
  X, Plus, Trash2, ChevronDown, ChevronUp,
  Users, Calendar, MessageCircle, Database,
  Mail, Clock, Save, Zap, GripVertical
} from 'lucide-react'

const MODULE_META = {
  candidate_filter: { label: 'Kandidaten Filter', Icon: Users,         color: '#534AB7', bg: '#EEEDFE' },
  shift_fetcher:    { label: 'Diensten Ophalen',  Icon: Calendar,      color: '#0F6E56', bg: '#E1F5EE' },
  whatsapp_send:    { label: 'WhatsApp Sturen',   Icon: MessageCircle, color: '#3B6D11', bg: '#EAF3DE' },
  database_update:  { label: 'Database Updaten',  Icon: Database,      color: '#185FA5', bg: '#E6F1FB' },
  email_send:       { label: 'E-mail Sturen',     Icon: Mail,          color: '#854F0B', bg: '#FAEEDA' },
  delay:            { label: 'Wachttijd',          Icon: Clock,         color: '#5F5E5A', bg: '#F1EFE8' },
}

const MODULE_SCHEMAS = {
  candidate_filter: [
    { key: 'status',                label: 'Status',                 type: 'select',      options: ['actief','inactief','alle'] },
    { key: 'pools',                 label: 'Pools',                  type: 'multiselect', options: ['Pool 7','Pool 8','Pool 9','Pool 10','Pool ZZP'] },
    { key: 'days_since_last_shift', label: 'Dagen zonder dienst',    type: 'number',      placeholder: '30' },
    { key: 'features',              label: 'Vaardigheden',           type: 'multiselect', options: ['BHV','Nachtdienst','Gastouder','Verzorging IG'] },
    { key: 'limit',                 label: 'Max. kandidaten',        type: 'number',      placeholder: '100' },
  ],
  shift_fetcher: [
    { key: 'connection_id',       label: 'Planning systeem',        type: 'select',  options: ['ShiftManager (Yesway)','Intus','SDB'] },
    { key: 'hours_ahead',         label: 'Uren vooruit',            type: 'number',  placeholder: '72' },
    { key: 'min_hours_available', label: 'Min. uur beschikbaar',    type: 'number',  placeholder: '36' },
  ],
  whatsapp_send: [
    { key: 'message_type',        label: 'Berichttype',             type: 'select',  options: ['template','flow'] },
    { key: 'phone_number_id',     label: 'Afzender',                type: 'select',  options: ['085 020 5160 (Yesway)','085 020 5161 (Yesway 2)'] },
    { key: 'template_name',       label: 'Template naam',           type: 'text',    placeholder: 'geen_reactie_shiftmanager' },
    { key: 'update_conversation', label: 'Gespreksstatus updaten',  type: 'boolean' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',         type: 'number',  placeholder: '30' },
  ],
  database_update: [
    { key: 'model',               label: 'Model',                   type: 'select',  options: ['Candidate','Conversation','Message'] },
    { key: 'set_status',          label: 'Zet status naar',         type: 'text',    placeholder: 'AWAITING_SHIFTS_OFFERED' },
    { key: 'set_last_contacted',  label: 'Zet last_contacted = nu', type: 'boolean' },
  ],
  email_send: [
    { key: 'to',       label: 'Aan',        type: 'text',   placeholder: 'flex@yesway.nu' },
    { key: 'subject',  label: 'Onderwerp',  type: 'text',   placeholder: 'Dienst overzicht' },
    { key: 'template', label: 'Template',   type: 'select', options: ['shift_summary','no_response_report','daily_overview'] },
  ],
  delay: [
    { key: 'hours',         label: 'Wachten (uren)',    type: 'number',  placeholder: '24' },
    { key: 'skip_weekends', label: 'Weekend overslaan', type: 'boolean' },
  ],
}

const TRIGGER_OPTIONS = [
  'Dagelijks 07:00','Dagelijks 08:00','Dagelijks 09:00',
  'Dagelijks 10:00','Dagelijks 12:00','Elk uur',
  'Maandag 07:00','Handmatig',
]

const uid = () => 'step_' + Math.random().toString(36).slice(2, 8)

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
  const [expandedId,  setExpandedId]  = useState(steps[0]?.id || null)
  const [showPicker,  setShowPicker]  = useState(false)
  const [saved,       setSaved]       = useState(false)

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
    onSave({ ...workflow, name, trigger, steps })
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

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Trigger</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value)}
              className="w-full text-sm text-gray-800 rounded-lg"
              style={{ padding: '9px 11px', border: '1px solid #E5E7EB', background: 'white', outline: 'none' }}>
              {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
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
    </>
  )
}