import { useState, useEffect, useRef, useMemo } from 'react'
import { Save, RefreshCw, Plus, Trash2, Shield, Target, RotateCcw, Check, Clock, AlertTriangle, ClipboardList, Search, X, LayoutDashboard, Palette, Mail, Upload, Eye, EyeOff, Webhook, Copy, Users } from 'lucide-react'
import UsersPage from './UsersPage'
import { useAuth } from '../context/AuthContext'
import { useRightPanel } from '../context/RightPanelContext'
import api from '../lib/api'
import { invalidateKpiCache } from '../lib/useKpiSettings'

// ─── Gedeelde save/load helper ────────────────────────────────────────────────

async function loadSettings() {
  const res = await api.get('/settings')
  return res.data ?? {}
}

async function saveSettings(payload) {
  const stringified = {}
  Object.entries(payload).forEach(([k, v]) => (stringified[k] = String(v)))
  await api.post('/settings', stringified)
  invalidateKpiCache()
}

// ─── KPI instellingen ────────────────────────────────────────────────────────

const DEFAULT_KPIS = [
  { key: 'new_candidates_target',   label: 'Doel nieuwe kandidaten / maand', value: 15,  unit: 'kandidaten', description: 'Maandelijks streefgetal voor nieuwe inschrijvingen' },
  { key: 'churn_warning_threshold', label: 'Uitstroom waarschuwingsgrens',   value: 10,  unit: '%',          description: 'Percentage uitstroom waarbij een waarschuwing getoond wordt' },
  { key: 'avg_candidates_window',   label: 'Gemiddelde berekeningsperiode',  value: 12,  unit: 'maanden',    description: 'Aantal maanden voor berekening van het voortschrijdend gemiddelde' },
  { key: 'occupancy_target',        label: 'Bezettingsgraad doel',           value: 85,  unit: '%',          description: 'Streefwaarde voor bezettingsgraad' },
  { key: 'response_rate_target',    label: 'Response rate doel',             value: 80,  unit: '%',          description: 'Streefwaarde voor kandidaat response op berichten' },
]

// ─── Weergave instellingen ────────────────────────────────────────────────────

const DEFAULT_DISPLAY = [
  { key: 'candidates_per_page', label: 'Kandidaten per API-aanroep', value: 500, unit: 'records', description: 'Maximaal aantal kandidaten dat in één keer wordt opgehaald' },
  { key: 'top_cities_n',        label: 'Top N woonplaatsen',          value: 10,  unit: 'steden',  description: 'Aantal woonplaatsen getoond in de woonplaatsen-grafiek' },
  { key: 'shifts_detail_limit', label: 'Diensten detail limiet',      value: 500, unit: 'records', description: 'Maximaal aantal diensten in het detailoverzicht' },
  { key: 'activity_log_limit',  label: 'Audit log entries',           value: 200, unit: 'entries', description: 'Maximaal aantal audit log entries dat wordt opgehaald' },
]

function KpiSettings() {
  const [kpis,    setKpis]    = useState(DEFAULT_KPIS.map(k => ({ ...k })))
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  const update = (key, val) =>
    setKpis(prev => prev.map(k => k.key === key ? { ...k, value: Number(val) } : k))

  useEffect(() => {
    loadSettings()
      .then(stored => setKpis(prev => prev.map(k => stored[k.key] !== undefined ? { ...k, value: Number(stored[k.key]) } : k)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    const payload = {}
    kpis.forEach(k => (payload[k.key] = k.value))
    try {
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>KPI Instellingen</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Streefwaarden voor dashboards en rapportages</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                   border: 'none', opacity: saving ? 0.7 : 1,
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white', transition: 'background 0.2s' }}>
          {saved   ? <><Check size={13} /> Opgeslagen</>                         :
           saving  ? <><RefreshCw size={13} className="animate-spin" /> Opslaan…</> :
                     <><Save size={13} /> Opslaan</>}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>Instellingen ophalen…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {kpis.map(kpi => (
          <div key={kpi.key}
            style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '14px 16px',
                     display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{kpi.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{kpi.description}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <input
                type="number" min={0} value={kpi.value}
                onChange={e => update(kpi.key, e.target.value)}
                style={{ width: 80, height: 34, textAlign: 'right', padding: '0 10px', fontSize: 14,
                         fontWeight: 600, color: '#111827', border: '1px solid #E5E7EB', borderRadius: 8,
                         outline: 'none' }}
              />
              <span style={{ fontSize: 12, color: '#9CA3AF', width: 70 }}>{kpi.unit}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

// ─── Rollen & Rechten ────────────────────────────────────────────────────────

const PERMISSION_LABELS = {
  candidates:   'Kandidaten',
  customers:    'Klanten',
  reports:      'Rapportages',
  workflows:    'Workflows',
  whatsapp:     'WhatsApp',
  users:        'Gebruikers',
  settings:     'Instellingen',
  sync:         'Synchronisatie',
}

const ACTION_LABELS = {
  view:    'Bekijken',
  create:  'Aanmaken',
  edit:    'Bewerken',
  delete:  'Verwijderen',
  sync:    'Synchroniseren',
  refresh: 'Vernieuwen',
  export:  'Exporteren',
}

function PermissionToggle({ checked, onChange }) {
  return (
    <button onClick={onChange}
      style={{ width: 32, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
               background: checked ? 'var(--color-primary)' : '#E5E7EB', position: 'relative',
               transition: 'background 0.15s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
                    borderRadius: '50%', background: 'white', transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function DisplaySettings() {
  const [items,   setItems]   = useState(DEFAULT_DISPLAY.map(k => ({ ...k })))
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  const update = (key, val) =>
    setItems(prev => prev.map(k => k.key === key ? { ...k, value: Number(val) } : k))

  useEffect(() => {
    loadSettings()
      .then(stored => setItems(prev => prev.map(k => stored[k.key] !== undefined ? { ...k, value: Number(stored[k.key]) } : k)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    const payload = {}
    items.forEach(k => (payload[k.key] = k.value))
    try {
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Weergave-instellingen</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Limieten en standaardwaarden voor tabellen en grafieken</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                   border: 'none', opacity: saving ? 0.7 : 1,
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white' }}>
          {saved  ? <><Check size={13} /> Opgeslagen</>                           :
           saving ? <><RefreshCw size={13} className="animate-spin" /> Opslaan…</> :
                    <><Save size={13} /> Opslaan</>}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>Instellingen ophalen…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.key}
            style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10,
                     padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.description}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <input type="number" min={1} value={item.value}
                onChange={e => update(item.key, e.target.value)}
                style={{ width: 80, height: 34, textAlign: 'right', padding: '0 10px', fontSize: 14,
                         fontWeight: 600, color: '#111827', border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }} />
              <span style={{ fontSize: 12, color: '#9CA3AF', width: 60 }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Rollen & Rechten ────────────────────────────────────────────────────────

function RolesSettings() {
  const [roles,       setRoles]       = useState([])
  const [permissions, setPermissions] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [creating,    setCreating]    = useState(false)

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/permissions')])
      .then(([rolesRes, permsRes]) => {
        setRoles(rolesRes.data)
        setPermissions(permsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasPermission = (role, perm) =>
    role.permissions?.some(p => p.name === perm)

  const togglePermission = async (role, permName) => {
    const current = role.permissions?.map(p => p.name) ?? []
    const updated = current.includes(permName)
      ? current.filter(p => p !== permName)
      : [...current, permName]

    setSaving(role.id)
    try {
      const res = await api.put(`/roles/${role.id}/permissions`, { permissions: updated })
      setRoles(prev => prev.map(r => r.id === role.id ? res.data : r))
    } catch {}
    setSaving(null)
  }

  const createRole = async () => {
    if (!newRoleName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/roles', { name: newRoleName.trim() })
      setRoles(prev => [...prev, res.data])
      setNewRoleName('')
    } catch {}
    setCreating(false)
  }

  const deleteRole = async (role) => {
    if (!confirm(`Rol "${role.name}" verwijderen?`)) return
    try {
      await api.delete(`/roles/${role.id}`)
      setRoles(prev => prev.filter(r => r.id !== role.id))
    } catch {}
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 200 }}>
      <p style={{ fontSize: 13, color: '#9CA3AF' }}>Rollen ophalen…</p>
    </div>
  )

  const allPerms = Object.entries(permissions).flatMap(([group, perms]) =>
    perms.map(p => ({ ...p, group }))
  )

  const grouped = Object.entries(permissions)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Rollen & Rechten</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Beheer wie toegang heeft tot welke onderdelen</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
            placeholder="Nieuwe rol…"
            onKeyDown={e => e.key === 'Enter' && createRole()}
            style={{ height: 34, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB',
                     borderRadius: 8, outline: 'none', color: '#374151', width: 150 }} />
          <button onClick={createRole} disabled={creating || !newRoleName.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer', border: 'none',
                     background: 'var(--color-primary)', color: 'white', opacity: newRoleName.trim() ? 1 : 0.4 }}>
            <Plus size={13} /> Aanmaken
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {roles.map(role => (
          <div key={role.id}
            style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>

            {/* Rol header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderBottom: '1px solid #F9FAFB', background: '#FAFAFA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={14} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{role.name}</span>
                {saving === role.id && <RefreshCw size={11} className="animate-spin" style={{ color: '#9CA3AF' }} />}
              </div>
              <button onClick={() => deleteRole(role)}
                style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
                <Trash2 size={13} />
              </button>
            </div>

            {/* Rechten grid */}
            <div style={{ padding: '12px 16px' }}>
              {grouped.map(([group, perms]) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                                letterSpacing: '0.05em', marginBottom: 6 }}>
                    {PERMISSION_LABELS[group] ?? group}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {perms.map(perm => {
                      const action = perm.name.split('.')[1] ?? perm.name
                      const on = hasPermission(role, perm.name)
                      return (
                        <label key={perm.name}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                   background: on ? 'var(--color-primary-bg)' : '#F9FAFB',
                                   border: `1px solid ${on ? 'var(--color-primary)' : '#E5E7EB'}`,
                                   borderRadius: 20, padding: '3px 10px 3px 6px', transition: 'all 0.15s' }}>
                          <PermissionToggle checked={on} onChange={() => togglePermission(role, perm.name)} />
                          <span style={{ fontSize: 12, color: on ? 'var(--color-primary)' : '#6B7280',
                                         fontWeight: on ? 500 : 400 }}>
                            {ACTION_LABELS[action] ?? action}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Synchronisatie ──────────────────────────────────────────────────────────

const SYNC_ENDPOINTS = [
  { key: 'candidates',    label: 'Kandidaten',      endpoint: '/candidates/sync',  description: 'Kandidatendata vanuit het planningssysteem' },
  { key: 'customers',     label: 'Klanten',          endpoint: '/customers/sync',   description: 'Klanten vanuit het planningssysteem' },
  { key: 'locations',     label: 'Locaties',         endpoint: '/customers/sync',   description: 'Locaties worden meegesynchroniseerd via klanten', note: 'Via klanten sync' },
  { key: 'departments',   label: 'Afdelingen',       endpoint: '/customers/sync',   description: 'Afdelingen worden meegesynchroniseerd via klanten', note: 'Via klanten sync' },
  { key: 'contacts',      label: 'Contactpersonen',  endpoint: '/customers/sync',   description: 'Contactpersonen per klant synchroniseren', note: 'Via klanten sync' },
  { key: 'orders',        label: 'Diensten',         endpoint: null,                description: 'Dienstenoverzicht vanuit het planningssysteem', disabled: true },
  { key: 'shifts',        label: 'Shifts',           endpoint: null,                description: 'Shift details vanuit het planningssysteem', disabled: true },
  { key: 'invites',       label: 'Inplanningen',     endpoint: null,                description: 'Kandidaatinplanningen per shift', disabled: true },
]

const COOLDOWN_SECS = 60

function useLiveTimer(running) {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (running) {
      setElapsed(0)
      ref.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      clearInterval(ref.current)
    }
    return () => clearInterval(ref.current)
  }, [running])
  return elapsed
}

function SyncRow({ item, user, canSync, onLog }) {
  const [result,   setResult]   = useState(null)
  const [running,  setRunning]  = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const coolRef = useRef(null)
  const elapsed = useLiveTimer(running)

  const startCooldown = (secs) => {
    setCooldown(secs)
    coolRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(coolRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const run = async () => {
    if (!item.endpoint || running || cooldown > 0) return
    setRunning(true)
    setResult(null)
    const start = Date.now()
    try {
      const res     = await api.post(item.endpoint)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      const entry   = { ok: true, msg: res.data?.message ?? 'Geslaagd', elapsed,
                        at: new Date().toLocaleTimeString('nl-NL'), user: user?.name ?? '—', label: item.label }
      setResult(entry)
      onLog(entry)
      startCooldown(COOLDOWN_SECS)
    } catch (err) {
      const retryAfter = err.response?.data?.retry_after
      const msg = err.response?.status === 429
        ? `Te veel verzoeken — wacht ${retryAfter ?? 60}s`
        : (err.response?.data?.message ?? 'Mislukt')
      const entry = { ok: false, msg, at: new Date().toLocaleTimeString('nl-NL'), user: user?.name ?? '—', label: item.label }
      setResult(entry)
      onLog(entry)
      if (retryAfter) startCooldown(retryAfter)
    }
    setRunning(false)
  }

  const blocked = running || cooldown > 0 || item.disabled || !canSync

  return (
    <div style={{ background: item.disabled ? '#FAFAFA' : 'white',
                  border: '1px solid #F3F4F6', borderRadius: 10,
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16,
                  opacity: item.disabled ? 0.55 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.label}</span>
          {item.note && (
            <span style={{ fontSize: 10, color: '#9CA3AF', background: '#F3F4F6',
                           borderRadius: 4, padding: '1px 6px' }}>{item.note}</span>
          )}
          {item.disabled && (
            <span style={{ fontSize: 10, color: '#F59E0B', background: '#FFFBEB',
                           border: '1px solid #FDE68A', borderRadius: 4, padding: '1px 6px' }}>
              Binnenkort
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.description}</div>
        {running && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            Bezig… {elapsed}s
          </div>
        )}
        {result && !running && (
          <div style={{ marginTop: 6, fontSize: 12, color: result.ok ? '#16A34A' : '#DC2626',
                        display: 'flex', alignItems: 'center', gap: 4 }}>
            {result.ok ? <Check size={11} /> : <AlertTriangle size={11} />}
            {result.msg}
            {result.elapsed && <span style={{ color: '#9CA3AF' }}>· {result.elapsed}s</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <button onClick={run} disabled={blocked}
          title={!canSync ? 'Je hebt geen toestemming om te synchroniseren' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8,
                   cursor: blocked ? 'not-allowed' : 'pointer',
                   border: `1px solid ${!canSync ? '#FCA5A5' : '#E5E7EB'}`,
                   background: !canSync ? '#FFF5F5' : '#F9FAFB',
                   color: !canSync ? '#EF4444' : '#374151',
                   opacity: (running || cooldown > 0 || item.disabled) ? 0.5 : 1 }}>
          <RotateCcw size={13} className={running ? 'animate-spin' : ''} />
          {running ? `${elapsed}s…` : !canSync ? 'Geen toegang' : 'Sync'}
        </button>
        {cooldown > 0 && (
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
            Cooldown: {cooldown}s
          </span>
        )}
      </div>
    </div>
  )
}

function SyncSettings() {
  const { user, hasPermission } = useAuth()
  const canSync = hasPermission('sync.refresh') || hasPermission('candidates.sync') || hasPermission('customers.sync')
  const [log, setLog] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sync_log') ?? '[]') } catch { return [] }
  })

  const addLog = (entry) => {
    setLog(prev => {
      const next = [entry, ...prev].slice(0, 50)
      sessionStorage.setItem('sync_log', JSON.stringify(next))
      return next
    })
  }

  return (
    <div>
      <div className="mb-5">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Synchronisatie</h2>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
          Handmatig data ophalen · max 1x per {COOLDOWN_SECS}s per item
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {SYNC_ENDPOINTS.map(item => (
          <SyncRow key={item.key} item={item} user={user} canSync={canSync} onLog={addLog} />
        ))}
      </div>

      {log.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            Sessie log
          </h3>
          <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
            {log.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                    borderBottom: i < log.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                              background: entry.ok ? '#16A34A' : '#EF4444' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#111827', width: 120, flexShrink: 0 }}>{entry.label}</span>
                <span style={{ fontSize: 12, color: entry.ok ? '#16A34A' : '#DC2626', flex: 1 }}>{entry.msg}</span>
                {entry.elapsed && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{entry.elapsed}s</span>}
                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{entry.user}</span>
                <span style={{ fontSize: 11, color: '#D1D5DB', flexShrink: 0 }}>{entry.at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Audit log ───────────────────────────────────────────────────────────────

// ─── Audit log drill-down drawer ─────────────────────────────────────────────

function DiffRow({ label, before, after }) {
  const changed = JSON.stringify(before) !== JSON.stringify(after)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                  padding: '7px 0', borderBottom: '1px solid #F9FAFB', alignItems: 'start' }}>
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
      <div style={{ fontSize: 12, background: changed ? '#FEF2F2' : '#F9FAFB',
                    borderRadius: 6, padding: '3px 8px', color: changed ? '#DC2626' : '#6B7280' }}>
        {Array.isArray(before) ? (before.length ? before.join(', ') : 'geen') : String(before ?? '—')}
      </div>
      <div style={{ fontSize: 12, background: changed ? '#F0FDF4' : '#F9FAFB',
                    borderRadius: 6, padding: '3px 8px', color: changed ? '#16A34A' : '#6B7280' }}>
        {Array.isArray(after)  ? (after.length  ? after.join(', ')  : 'geen') : String(after  ?? '—')}
      </div>
    </div>
  )
}

function AuditDrawer({ entry, onClose }) {
  const p = entry.properties ?? {}
  const logName = entry.log_name

  const renderContent = () => {
    if (logName === 'sync') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Gesynchroniseerd', value: p.synced ?? p.customers ?? p.candidates ?? '—', color: '#16A34A' },
            { label: 'Totaal',           value: p.total ?? '—' },
            { label: 'Fouten',           value: p.errors ?? '0', color: p.errors > 0 ? '#DC2626' : undefined },
            { label: 'Duur',             value: p.duration ?? '—' },
            { label: 'Locaties',         value: p.locations },
            { label: 'Afdelingen',       value: p.departments },
          ].filter(r => r.value !== undefined && r.value !== null).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{r.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: r.color ?? '#111827' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )
    }

    if (logName === 'roles' && p.before !== undefined && p.after !== undefined) {
      const allPerms = [...new Set([...(p.before ?? []), ...(p.after ?? [])])].sort()
      const added    = (p.after ?? []).filter(x => !(p.before ?? []).includes(x))
      const removed  = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                        padding: '6px 0', marginBottom: 4 }}>
            <span />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>Voor</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>Na</span>
          </div>
          {allPerms.map(perm => (
            <DiffRow key={perm} label={perm}
              before={(p.before ?? []).includes(perm) ? '✓ actief' : '— inactief'}
              after={(p.after  ?? []).includes(perm) ? '✓ actief' : '— inactief'} />
          ))}
          {(added.length > 0 || removed.length > 0) && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
              {added.length > 0 && (
                <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', marginBottom: 6 }}>
                    Toegevoegd ({added.length})
                  </div>
                  {added.map(p => <div key={p} style={{ fontSize: 12, color: '#374151' }}>{p}</div>)}
                </div>
              )}
              {removed.length > 0 && (
                <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', marginBottom: 6 }}>
                    Verwijderd ({removed.length})
                  </div>
                  {removed.map(p => <div key={p} style={{ fontSize: 12, color: '#374151' }}>{p}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    if (logName === 'settings') {
      if (p.before && p.after) {
        const changed = Object.keys(p.after).filter(k => String(p.before[k]) !== String(p.after[k]))
        const unchanged = Object.keys(p.after).filter(k => String(p.before[k]) === String(p.after[k]))
        return (
          <div>
            {changed.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Gewijzigd ({changed.length})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 8,
                              padding: '6px 0', marginBottom: 4 }}>
                  <span />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>Oude waarde</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>Nieuwe waarde</span>
                </div>
                {changed.map(k => (
                  <DiffRow key={k} label={KPI_LABELS[k] ?? k} before={p.before[k] ?? '—'} after={p.after[k]} />
                ))}
              </>
            )}
            {unchanged.length > 0 && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 11, color: '#9CA3AF', cursor: 'pointer' }}>
                  Ongewijzigd ({unchanged.length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  {unchanged.map(k => (
                    <DiffRow key={k} label={KPI_LABELS[k] ?? k} before={p.before[k]} after={p.after[k]} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )
      }
      const keys = p.keys ?? []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
            {keys.length} instelling{keys.length !== 1 ? 'en' : ''} bijgewerkt
          </p>
          {keys.map(k => (
            <div key={k} style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px',
                                   fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{KPI_LABELS[k] ?? k}</div>
          ))}
        </div>
      )
    }

    // Generiek fallback
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(p).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: '#F9FAFB',
                                borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>{k}</span>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
              {Array.isArray(v) ? v.join(', ') : String(v)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const meta = LOG_NAME_META[entry.log_name] ?? { label: entry.log_name, color: '#6B7280' }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <LogBadge logName={entry.log_name} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{entry.description}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                <strong style={{ color: '#374151' }}>{entry.causer_name ?? 'Systeem'}</strong>
                {entry.causer_email && <span> · {entry.causer_email}</span>}
                <span> · {new Date(entry.created_at).toLocaleString('nl-NL', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</span>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {renderContent()}
        </div>
      </div>
    </>
  )
}

const LOG_NAME_META = {
  sync:     { label: 'Synchronisatie',    bg: '#EFF6FF', color: '#2563EB' },
  roles:    { label: 'Rollen',            bg: '#F5F3FF', color: '#6D28D9' },
  settings: { label: 'KPI Instellingen',  bg: '#ECFDF5', color: '#059669' },
  users:    { label: 'Gebruikers',        bg: '#FFF7ED', color: '#C2410C' },
}

function LogBadge({ logName }) {
  const m = LOG_NAME_META[logName] ?? { label: logName, bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                   background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function PropertiesCell({ properties }) {
  if (!properties || Object.keys(properties).length === 0) return <span style={{ color: '#D1D5DB' }}>—</span>

  const LABELS = {
    synced: 'Gesynchroniseerd', total: 'Totaal', errors: 'Fouten', duration: 'Duur',
    keys: 'Sleutels', name: 'Naam', permissions: 'Rechten',
    before: 'Voor', after: 'Na', role: 'Rol',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(properties).map(([k, v]) => {
        const label = LABELS[k] ?? k
        let display = v
        if (Array.isArray(v)) display = v.length === 0 ? 'geen' : v.join(', ')
        else if (typeof v === 'object' && v !== null) display = JSON.stringify(v)
        else display = String(v)
        return (
          <div key={k} style={{ fontSize: 11, color: '#6B7280' }}>
            <span style={{ color: '#9CA3AF' }}>{label}: </span>
            <span style={{ color: '#374151', fontWeight: 500 }}>{display}</span>
          </div>
        )
      })}
    </div>
  )
}

const KPI_LABELS = {
  new_candidates_target:   'Doel nieuwe kandidaten',
  churn_warning_threshold: 'Uitstroom grens',
  avg_candidates_window:   'Gem. periode',
  occupancy_target:        'Bezettingsgraad doel',
  response_rate_target:    'Response rate doel',
}

function buildDiffCells(entry) {
  const p = entry.properties ?? {}

  if (entry.log_name === 'roles') {
    if (p.before !== undefined && p.after !== undefined) {
      const removed = (p.before ?? []).filter(x => !(p.after ?? []).includes(x))
      const added   = (p.after  ?? []).filter(x => !(p.before ?? []).includes(x))
      return {
        beforeCell: removed.length ? removed.join(', ') : '—',
        afterCell:  added.length   ? added.join(', ')   : '—',
      }
    }
    if (p.name) return { beforeCell: '—', afterCell: p.name }
  }

  if (entry.log_name === 'settings') {
    if (p.before && p.after) {
      const changed = Object.keys(p.after).filter(k => String(p.before[k]) !== String(p.after[k]))
      if (!changed.length) return { beforeCell: '—', afterCell: 'Geen wijzigingen' }
      return {
        beforeCell: changed.map(k => `${KPI_LABELS[k] ?? k}: ${p.before[k] ?? '—'}`).join(' · '),
        afterCell:  changed.map(k => `${KPI_LABELS[k] ?? k}: ${p.after[k]}`).join(' · '),
      }
    }
    if (p.keys) return { beforeCell: '—', afterCell: `${p.keys.length} sleutel(s) bijgewerkt` }
  }

  if (entry.log_name === 'sync') {
    return {
      beforeCell: '—',
      afterCell: [
        p.synced    != null && `${p.synced} gesync`,
        p.errors    != null && p.errors > 0 && `${p.errors} fouten`,
        p.duration  != null && p.duration,
      ].filter(Boolean).join(' · ') || '—',
    }
  }

  return { beforeCell: '—', afterCell: '—' }
}

function AuditLog() {
  const [logs,           setLogs]           = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [search,         setSearch]         = useState('')
  const [selectedTypes,  setSelectedTypes]  = useState([])
  const [selectedUsers,  setSelectedUsers]  = useState([])
  const [selectedRoles,  setSelectedRoles]  = useState([])
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [drill,          setDrill]          = useState(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/activity-log')
      .then(res => setLogs(res.data?.data ?? res.data ?? []))
      .catch(() => setError('Audit log niet beschikbaar.'))
      .finally(() => setLoading(false))
  }, [])

  const typeOptions  = useMemo(() => [...new Set(logs.map(l => l.log_name).filter(Boolean))].sort(), [logs])
  const userOptions  = useMemo(() => [...new Set(logs.map(l => l.causer_name).filter(Boolean))].sort(), [logs])
  const roleOptions  = useMemo(() => [...new Set(
    logs.filter(l => l.log_name === 'roles')
        .map(l => l.properties?.role ?? l.properties?.name)
        .filter(Boolean)
  )].sort(), [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter(l => {
      if (selectedTypes.length  && !selectedTypes.includes(l.log_name))    return false
      if (selectedUsers.length  && !selectedUsers.includes(l.causer_name)) return false
      if (selectedRoles.length) {
        const role = l.properties?.role ?? l.properties?.name
        if (!role || !selectedRoles.includes(role)) return false
      }
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom))         return false
      if (dateTo   && new Date(l.created_at) > new Date(dateTo + 'T23:59:59')) return false
      if (!q) return true
      return (
        (l.description  ?? '').toLowerCase().includes(q) ||
        (l.causer_name  ?? '').toLowerCase().includes(q) ||
        (l.causer_email ?? '').toLowerCase().includes(q)
      )
    })
  }, [logs, search, selectedTypes, selectedUsers, selectedRoles, dateFrom, dateTo])

  const filterGroups = useMemo(() => [
    {
      key: 'type', label: 'Type',
      selected: selectedTypes,
      options: typeOptions.map(t => ({
        value: t, label: LOG_NAME_META[t]?.label ?? t,
        count: logs.filter(l => l.log_name === t).length,
      })),
      onToggle: v => setSelectedTypes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      key: 'user', label: 'Door wie',
      selected: selectedUsers,
      options: userOptions.map(u => ({
        value: u, label: u,
        count: logs.filter(l => l.causer_name === u).length,
      })),
      onToggle: v => setSelectedUsers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    ...(roleOptions.length > 0 ? [{
      key: 'role', label: 'Rol',
      type: 'search-select',
      selected: selectedRoles,
      options: roleOptions.map(r => ({
        value: r, label: r,
        count: logs.filter(l => (l.properties?.role ?? l.properties?.name) === r).length,
      })),
      onToggle: v => setSelectedRoles(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    }] : []),
  ], [selectedTypes, selectedUsers, selectedRoles, typeOptions, userOptions, roleOptions, logs])

  useEffect(() => {
    registerFilters('audit-log', filterGroups)
    return () => unregisterFilters('audit-log')
  }, [filterGroups, registerFilters, unregisterFilters])

  const formatDT = (dt) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit',
                                                   year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
               color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
               whiteSpace: 'nowrap' }
  const TD = { padding: '10px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #F9FAFB',
               verticalAlign: 'top' }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header + zoekbalk */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Audit log</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            {loading ? 'Laden…' : `${filtered.length} van ${logs.length} entries`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Datum van */}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E5E7EB',
                     borderRadius: 8, color: '#374151', outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>t/m</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E5E7EB',
                     borderRadius: 8, color: '#374151', outline: 'none' }} />
          {/* Zoekbalk */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%',
                                       transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op actie of gebruiker…"
              style={{ height: 34, width: 220, paddingLeft: 28, paddingRight: 10, fontSize: 12,
                       border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FFFBEB',
                      border: '1px solid #FDE68A', fontSize: 13, color: '#92400E', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 130 }}>Datum &amp; tijd</th>
                <th style={{ ...TH, width: 120 }}>Door wie</th>
                <th style={{ ...TH, width: 120 }}>Type</th>
                <th style={{ ...TH, width: 180 }}>Actie</th>
                <th style={TH}>Oude waarde</th>
                <th style={TH}>Nieuwe waarde</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9CA3AF', padding: '32px 0' }}>
                    Geen entries gevonden
                  </td>
                </tr>
              ) : filtered.map((entry, i) => {
                const p = entry.properties ?? {}
                const { beforeCell, afterCell } = buildDiffCells(entry)
                return (
                  <tr key={entry.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(entry)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 11 }}>
                      <div style={{ color: '#111827', fontWeight: 500 }}>
                        {new Date(entry.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div style={{ color: '#9CA3AF', fontSize: 10 }}>
                        {new Date(entry.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{entry.causer_name ?? 'Systeem'}</div>
                      {entry.causer_email && (
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{entry.causer_email}</div>
                      )}
                    </td>
                    <td style={TD}><LogBadge logName={entry.log_name} /></td>
                    <td style={{ ...TD, fontWeight: 500, color: '#111827' }}>{entry.description}</td>
                    <td style={{ ...TD, fontSize: 11, color: '#DC2626' }}>{beforeCell}</td>
                    <td style={{ ...TD, fontSize: 11, color: '#16A34A' }}>{afterCell}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {drill && <AuditDrawer entry={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

// ─── Huisstijl ───────────────────────────────────────────────────────────────

const BRAND_COLOR_PRESETS = [
  '#3B8FD4', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]

function BrandingSettings() {
  const [primaryColor, setPrimaryColor]   = useState('#3B8FD4')
  const [logoPreview,  setLogoPreview]    = useState(null)
  const [logoFile,     setLogoFile]       = useState(null)
  const [companyName,  setCompanyName]    = useState('')
  const [saved,        setSaved]          = useState(false)
  const [saving,       setSaving]         = useState(false)
  const [loading,      setLoading]        = useState(true)
  const fileRef = useRef(null)

  useEffect(() => {
    loadSettings()
      .then(stored => {
        if (stored.brand_color)    setPrimaryColor(stored.brand_color)
        if (stored.company_name)   setCompanyName(stored.company_name)
        if (stored.logo_url)       setLogoPreview(stored.logo_url)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const applyColor = (color) => {
    setPrimaryColor(color)
    document.documentElement.style.setProperty('--color-primary', color)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { brand_color: primaryColor, company_name: companyName }
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const res = await api.post('/settings/logo', fd)
        if (res.data?.logo_url) payload.logo_url = res.data.logo_url
      }
      await saveSettings(payload)
      document.documentElement.style.setProperty('--color-primary', primaryColor)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Huisstijl</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Kleur, logo en bedrijfsnaam voor dit platform</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                   border: 'none', opacity: saving ? 0.7 : 1,
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white', transition: 'background 0.2s' }}>
          {saved   ? <><Check size={13} /> Opgeslagen</>                         :
           saving  ? <><RefreshCw size={13} className="animate-spin" /> Opslaan…</> :
                     <><Save size={13} /> Opslaan</>}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>Instellingen ophalen…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Bedrijfsnaam */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 4 }}>Bedrijfsnaam</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Wordt getoond in de navigatiebalk en e-mails</div>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Bijv. MijnBedrijf B.V."
            style={{ height: 36, width: '100%', maxWidth: 320, padding: '0 12px', fontSize: 13,
                     border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#111827' }}
          />
        </div>

        {/* Primaire kleur */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 4 }}>Primaire kleur</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>Wordt gebruikt voor knoppen, links en actieve menu-items</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {BRAND_COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => applyColor(c)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                         cursor: 'pointer', outline: primaryColor === c ? `3px solid ${c}` : 'none',
                         outlineOffset: 2, transition: 'transform 0.1s', transform: primaryColor === c ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <input type="color" value={primaryColor}
                onChange={e => applyColor(e.target.value)}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E5E7EB',
                         cursor: 'pointer', padding: 2 }} />
              <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>{primaryColor}</span>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Voorbeeld:</span>
            <button style={{ height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
                             background: primaryColor, color: 'white', border: 'none', borderRadius: 7, cursor: 'default' }}>
              Knop voorbeeld
            </button>
            <span style={{ fontSize: 12, color: primaryColor, fontWeight: 500, cursor: 'default' }}>Link voorbeeld</span>
          </div>
        </div>

        {/* Logo */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 4 }}>Logo</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>PNG of SVG, max 2 MB — wordt getoond in de navigatiebalk</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" style={{ height: 48, maxWidth: 120, objectFit: 'contain',
                border: '1px solid #F3F4F6', borderRadius: 8, padding: 4 }} />
            ) : (
              <div style={{ width: 80, height: 48, borderRadius: 8, background: '#F9FAFB',
                            border: '1px dashed #D1D5DB', display: 'flex', alignItems: 'center',
                            justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>Geen logo</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                         fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                         border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151' }}>
                <Upload size={13} /> Uploaden
              </button>
              {logoPreview && (
                <button onClick={() => { setLogoPreview(null); setLogoFile(null) }}
                  style={{ height: 34, padding: '0 12px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                           border: '1px solid #FCA5A5', background: '#FFF5F5', color: '#EF4444' }}>
                  Verwijderen
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg"
              style={{ display: 'none' }} onChange={handleLogoChange} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── E-mail instellingen ──────────────────────────────────────────────────────

function EmailSettings() {
  const [provider,     setProvider]     = useState('manual')
  const [fromName,     setFromName]     = useState('')
  const [fromEmail,    setFromEmail]    = useState('')
  const [smtpHost,     setSmtpHost]     = useState('')
  const [smtpPort,     setSmtpPort]     = useState('587')
  const [smtpUser,     setSmtpUser]     = useState('')
  const [smtpPass,     setSmtpPass]     = useState('')
  const [smtpPassSet,  setSmtpPassSet]  = useState(false)
  const [smtpSecure,   setSmtpSecure]   = useState('tls')
  const [showPass,     setShowPass]     = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [testing,      setTesting]      = useState(false)
  const [testResult,   setTestResult]   = useState(null)

  useEffect(() => {
    loadSettings()
      .then(stored => {
        if (stored.email_provider)  setProvider(stored.email_provider)
        if (stored.email_from_name) setFromName(stored.email_from_name)
        if (stored.email_from)      setFromEmail(stored.email_from)
        if (stored.smtp_host)       setSmtpHost(stored.smtp_host)
        if (stored.smtp_port)       setSmtpPort(stored.smtp_port)
        if (stored.smtp_user)       setSmtpUser(stored.smtp_user)
        if (stored.smtp_secure)     setSmtpSecure(stored.smtp_secure)
        if (stored.smtp_pass)       setSmtpPassSet(stored.smtp_pass === '••••••••')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        email_provider: provider, email_from_name: fromName, email_from: fromEmail,
        smtp_host: smtpHost, smtp_port: smtpPort, smtp_user: smtpUser, smtp_secure: smtpSecure,
      }
      if (smtpPass) payload.smtp_pass = smtpPass
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post('/settings/email/test')
      setTestResult({ ok: true, msg: res.data?.message ?? 'Testmail verstuurd' })
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.message ?? 'Verbinding mislukt' })
    }
    setTesting(false)
  }

  const inputStyle = {
    height: 36, width: '100%', padding: '0 12px', fontSize: 13,
    border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#111827',
  }

  const labelStyle = { fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }

  const PROVIDERS = [
    { id: 'gmail',   label: 'Gmail',        desc: 'Verbind via OAuth2 of App-wachtwoord' },
    { id: 'office',  label: 'Office 365',   desc: 'Verbind via Microsoft OAuth2 of SMTP' },
    { id: 'manual',  label: 'Handmatig SMTP', desc: 'Eigen mailserver of provider' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>E-mail instellingen</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Verzendadres en verbinding voor de e-mailmodule</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={testConnection} disabled={testing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: testing ? 'wait' : 'pointer',
                     border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', opacity: testing ? 0.6 : 1 }}>
            {testing ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
            Test verbinding
          </button>
          <button onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                     border: 'none', opacity: saving ? 0.7 : 1,
                     background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white', transition: 'background 0.2s' }}>
            {saved   ? <><Check size={13} /> Opgeslagen</>                         :
             saving  ? <><RefreshCw size={13} className="animate-spin" /> Opslaan…</> :
                       <><Save size={13} /> Opslaan</>}
          </button>
        </div>
      </div>

      {testResult && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${testResult.ok ? '#86EFAC' : '#FCA5A5'}`,
                      color: testResult.ok ? '#16A34A' : '#DC2626' }}>
          {testResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
          {testResult.msg}
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>Instellingen ophalen…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Provider keuze */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 12 }}>E-mail provider</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => setProvider(p.id)}
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                         border: `1px solid ${provider === p.id ? 'var(--color-primary)' : '#E5E7EB'}`,
                         background: provider === p.id ? 'var(--color-primary-bg, #EFF6FF)' : '#F9FAFB',
                         transition: 'all 0.15s' }}>
                <div style={{ fontSize: 13, fontWeight: 600,
                              color: provider === p.id ? 'var(--color-primary)' : '#111827', marginBottom: 2 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.desc}</div>
              </button>
            ))}
          </div>

          {(provider === 'gmail' || provider === 'office') && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#FFFBEB',
                          border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E' }}>
              <strong>Backend vereist:</strong> OAuth2-koppeling voor {provider === 'gmail' ? 'Google' : 'Microsoft'} moet worden geconfigureerd via de backend.
              Sla het verzendadres hieronder op; de daadwerkelijke OAuth-verbinding wordt ingesteld door de beheerder.
            </div>
          )}
        </div>

        {/* Afzendergegevens */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 14 }}>Afzendergegevens</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Afzendernaam</label>
              <input value={fromName} onChange={e => setFromName(e.target.value)}
                placeholder="Bijv. KoiosConnect"
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Verzendadres (from)</label>
              <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)}
                placeholder="noreply@jouwbedrijf.nl"
                style={inputStyle} />
            </div>
          </div>
        </div>

        {/* SMTP (alleen bij handmatig) */}
        {provider === 'manual' && (
          <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 14 }}>SMTP configuratie</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>SMTP server</label>
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                  placeholder="smtp.jouwbedrijf.nl"
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Poort</label>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Gebruikersnaam</label>
                <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
                  placeholder="gebruiker@jouwbedrijf.nl"
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  Wachtwoord
                  {smtpPassSet && !smtpPass && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#16A34A', fontWeight: 400 }}>
                      ✓ ingesteld
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={smtpPass}
                    onChange={e => setSmtpPass(e.target.value)}
                    placeholder={smtpPassSet ? 'Laat leeg om huidig wachtwoord te behouden' : 'SMTP wachtwoord'}
                    style={{ ...inputStyle, paddingRight: 36 }} />
                  <button onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                             background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Beveiliging</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'tls',  label: 'STARTTLS (poort 587)' },
                  { id: 'ssl',  label: 'SSL/TLS (poort 465)' },
                  { id: 'none', label: 'Geen (niet aanbevolen)' },
                ].map(s => (
                  <button key={s.id} onClick={() => setSmtpSecure(s.id)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                             border: `1px solid ${smtpSecure === s.id ? 'var(--color-primary)' : '#E5E7EB'}`,
                             background: smtpSecure === s.id ? 'var(--color-primary-bg, #EFF6FF)' : '#F9FAFB',
                             color: smtpSecure === s.id ? 'var(--color-primary)' : '#374151',
                             fontWeight: smtpSecure === s.id ? 500 : 400 }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Hoofd pagina ─────────────────────────────────────────────────────────────

// ─── Webhooks ────────────────────────────────────────────────────────────────

function WebhooksSettings() {
  const [webhooks, setWebhooks] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState(null)

  const BASE_URL = 'http://koiosconnect-api.test/api/webhook'

  useEffect(() => {
    api.get('/webhooks')
      .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/webhooks', { name: name.trim(), description: desc.trim() || null })
      setWebhooks(prev => [...prev, res.data?.data ?? res.data])
      setName('')
      setDesc('')
    } catch {}
    setCreating(false)
  }

  const remove = async (id) => {
    if (!confirm('Webhook verwijderen?')) return
    await api.delete(`/webhooks/${id}`).catch(() => {})
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  const copyUrl = (token) => {
    navigator.clipboard.writeText(`${BASE_URL}/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Webhooks</h2>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
        Maak inkomende webhook-URLs aan om workflows te triggeren vanuit externe systemen.
      </p>

      {/* Nieuw aanmaken */}
      <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Nieuwe webhook</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Naam (bijv. Inkomende WhatsApp)"
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
            onKeyDown={e => e.key === 'Enter' && create()}
          />
          <input
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Omschrijving (optioneel)"
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
          />
        </div>
        <button onClick={create} disabled={!name.trim() || creating}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500,
                   background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>
          <Plus size={13} />
          {creating ? 'Aanmaken...' : 'Aanmaken'}
        </button>
      </div>

      {/* Lijst */}
      {loading ? (
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>Laden...</div>
      ) : webhooks.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>Nog geen webhooks aangemaakt.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {webhooks.map(wh => (
            <div key={wh.id} style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{wh.name}</div>
                  {wh.description && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{wh.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {wh.last_triggered_at && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Laatst: {new Date(wh.last_triggered_at).toLocaleDateString('nl-NL')}
                    </span>
                  )}
                  <button onClick={() => remove(wh.id)}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                             background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#DC2626' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ flex: 1, fontSize: 11, background: '#F9FAFB', border: '1px solid #E5E7EB',
                               borderRadius: 6, padding: '6px 10px', color: '#374151', wordBreak: 'break-all' }}>
                  {BASE_URL}/{wh.token}
                </code>
                <button onClick={() => copyUrl(wh.token)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, fontWeight: 500,
                           background: copied === wh.token ? '#DCFCE7' : '#F3F4F6', color: copied === wh.token ? '#16A34A' : '#374151',
                           border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === wh.token ? <Check size={11} /> : <Copy size={11} />}
                  {copied === wh.token ? 'Gekopieerd!' : 'Kopieer URL'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const NAV_GROUPS = [
  {
    label: 'Algemeen',
    items: [
      { id: 'kpis',     label: "KPI's",    icon: Target        },
      { id: 'display',  label: 'Weergave', icon: LayoutDashboard },
      { id: 'branding', label: 'Huisstijl', icon: Palette       },
    ],
  },
  {
    label: 'Communicatie',
    items: [
      { id: 'email',    label: 'E-mail',   icon: Mail    },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    ],
  },
  {
    label: 'Beheer',
    items: [
      { id: 'roles',  label: 'Rollen & Rechten', icon: Shield        },
      { id: 'users',  label: 'Gebruikers',        icon: Users         },
      { id: 'sync',   label: 'Synchronisatie',    icon: RotateCcw     },
      { id: 'audit',  label: 'Audit log',         icon: ClipboardList },
    ],
  },
]

const ALL_TABS = NAV_GROUPS.flatMap(g => g.items)

export default function SettingsPage() {
  const [tab, setTab] = useState('kpis')
  const current = ALL_TABS.find(t => t.id === tab)

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* Left nav */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6',
        background: 'white', overflowY: 'auto', padding: '20px 10px',
      }}>
        <div style={{ paddingLeft: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Instellingen</div>
        </div>

        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#C4C4CF', letterSpacing: '0.08em',
                          textTransform: 'uppercase', padding: '0 8px', marginBottom: 4 }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const Icon   = item.icon
              const active = tab === item.id
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left',
                    background: active ? 'var(--color-primary-bg)' : 'transparent',
                    color:      active ? 'var(--color-primary)'    : '#374151',
                    transition: 'all 0.12s', marginBottom: 1,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon size={14} style={{ flexShrink: 0,
                    color: active ? 'var(--color-primary)' : '#9CA3AF' }} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32, minWidth: 0 }}>
        {current && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{current.label}</h2>
          </div>
        )}

        {tab === 'kpis'     && <KpiSettings />}
        {tab === 'display'  && <DisplaySettings />}
        {tab === 'branding' && <BrandingSettings />}
        {tab === 'email'    && <EmailSettings />}
        {tab === 'roles'    && <RolesSettings />}
        {tab === 'users'    && <UsersPage />}
        {tab === 'sync'     && <SyncSettings />}
        {tab === 'webhooks' && <WebhooksSettings />}
        {tab === 'audit'    && <AuditLog />}
      </div>
    </div>
  )
}
