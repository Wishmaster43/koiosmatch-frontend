/**
 * SettingsPage — the whole settings area, split into tabs via a left-hand nav.
 *
 * Tabs (grouped into Algemeen / Communicatie / Beheer): KPI targets, branding,
 * email, webhooks, users, roles & permissions, and Apps (add-on toggles).
 * Each tab is its own component further down; this file also holds the shared
 * load/save helpers and the nav layout.
 *
 * Main blocks below:
 *   - loadSettings / saveSettings → shared GET/POST /settings helpers
 *   - DEFAULT_KPIS                → fallback KPI definitions
 *   - *Settings components         → one per tab (KPI, branding, roles, apps, ...)
 *   - SettingsPage                → the nav + renders the active tab
 */
import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { Save, RefreshCw, Plus, Trash2, Shield, Target, RotateCcw, Check, Clock, AlertTriangle, ClipboardList, Search, X, LayoutDashboard, Palette, Mail, Upload, Eye, EyeOff, Webhook, Copy, Users, AppWindow, ChevronDown, ChevronRight, Package, ArrowLeft, Brain, Zap, MessageCircle, Lock, ShieldCheck, Building2, MapPin, BookOpen, Layers, UserCheck, Briefcase, XCircle, Bell, Store, Key, Download, CreditCard, BarChart2, FileText, User, Settings2, GripVertical, CloudUpload, ChevronLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import UsersPage from '../users/UsersPage'
import { useAuth } from '../../context/AuthContext'
import { useApps, AVAILABLE_APPS } from '../../context/AppsContext'
import { useRightPanel } from '../../context/RightPanelContext'
import { canAccessPage } from '../../lib/access'
import api from '../../lib/api'
import { invalidateKpiCache } from '../../lib/useKpiSettings'

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
  // `module` group is intentionally omitted — module access is managed via the
  // Modules tab (accessible_pages), not as role permissions.
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

// ─── Rollen & Rechten ─────────────────────────────────────────────────────────
// Two-level UI: a list of roles → click "Bewerken" → detail view for that role.
// The detail shows permission groups (collapsible) with toggles per permission.
// The `module` group from the backend is always hidden here — module access is
// managed via the Modules settings tab (accessible_pages), not role permissions.

function RoleDetail({ role, permissions, onBack, onUpdate }) {
  const [localRole, setLocalRole]   = useState(role)
  const [editName,  setEditName]    = useState(false)
  const [draftName, setDraftName]   = useState(role.name)
  const [saving,    setSaving]      = useState(false)
  const [collapsed, setCollapsed]   = useState({})

  const hasPermission = (perm) => localRole.permissions?.some(p => p.name === perm)

  const togglePermission = async (permName) => {
    const current = localRole.permissions?.map(p => p.name) ?? []
    const updated = current.includes(permName)
      ? current.filter(p => p !== permName)
      : [...current, permName]
    setSaving(true)
    try {
      const res = await api.put(`/roles/${localRole.id}/permissions`, { permissions: updated })
      const updated_role = res.data
      setLocalRole(updated_role)
      onUpdate(updated_role)
    } catch {}
    setSaving(false)
  }

  const saveName = async () => {
    const name = draftName.trim()
    if (!name || name === localRole.name) { setEditName(false); return }
    setSaving(true)
    try {
      const res = await api.put(`/roles/${localRole.id}`, { name })
      const updated_role = { ...localRole, name: res.data?.name ?? name }
      setLocalRole(updated_role)
      onUpdate(updated_role)
    } catch {}
    setSaving(false)
    setEditName(false)
  }

  // Filter out the `module` group — managed separately in the Modules tab.
  const groups = Object.entries(permissions).filter(([g]) => g !== 'module')

  return (
    <div>
      {/* Back + role name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                   fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB',
                   color: '#374151', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Terug
        </button>
        <Shield size={14} style={{ color: 'var(--color-primary)' }} />
        {editName ? (
          <input autoFocus value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setDraftName(localRole.name); setEditName(false) } }}
            style={{ fontSize: 18, fontWeight: 700, color: '#111827', border: '1px solid var(--color-primary)',
                     borderRadius: 8, padding: '4px 10px', outline: 'none' }} />
        ) : (
          <h2 onClick={() => setEditName(true)} title="Klik om naam te bewerken"
            style={{ fontSize: 18, fontWeight: 700, color: '#111827', cursor: 'text', margin: 0 }}>
            {localRole.name}
          </h2>
        )}
        {saving && <RefreshCw size={13} className="animate-spin" style={{ color: '#9CA3AF' }} />}
      </div>

      {/* Permission groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(([group, perms]) => {
          const isOpen = !collapsed[group]
          return (
            <div key={group} style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
              {/* Group header — click to collapse */}
              <button onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                         background: '#FAFAFA', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                {isOpen ? <ChevronDown size={13} style={{ color: '#9CA3AF' }} /> : <ChevronRight size={13} style={{ color: '#9CA3AF' }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'capitalize' }}>
                  {PERMISSION_LABELS[group] ?? group}
                </span>
                <span style={{ fontSize: 11, color: '#C4C4CF', marginLeft: 'auto' }}>{perms.length} rechten</span>
              </button>
              {/* Permissions inside the group */}
              {isOpen && (
                <div>
                  {perms.map((perm, i) => {
                    const action  = perm.name.split('.')[1] ?? perm.name
                    const checked = hasPermission(perm.name)
                    return (
                      <div key={perm.name}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                 padding: '10px 16px', background: i % 2 ? '#FCFCFD' : 'white',
                                 borderTop: '1px solid #F9FAFB' }}>
                        <div>
                          <div style={{ fontSize: 13, color: '#111827', fontWeight: checked ? 500 : 400 }}>
                            {ACTION_LABELS[action] ?? action}
                          </div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{perm.name}</div>
                        </div>
                        <PermissionToggle checked={checked} onChange={() => togglePermission(perm.name)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RolesSettings() {
  const [roles,       setRoles]       = useState([])
  const [permissions, setPermissions] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [newRoleName, setNewRoleName] = useState('')
  const [creating,    setCreating]    = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [editRole,    setEditRole]    = useState(null)   // the role currently open in detail view

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/permissions')])
      .then(([rolesRes, permsRes]) => {
        setRoles(rolesRes.data)
        setPermissions(permsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
    setDeleting(role.id)
    try {
      await api.delete(`/roles/${role.id}`)
      setRoles(prev => prev.filter(r => r.id !== role.id))
      if (editRole?.id === role.id) setEditRole(null)
    } catch {}
    setDeleting(null)
  }

  const handleUpdate = (updated) => {
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRole(updated)
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 200 }}>
      <p style={{ fontSize: 13, color: '#9CA3AF' }}>Rollen ophalen…</p>
    </div>
  )

  // System roles hidden entirely — not editable via the UI
  const visibleRoles = roles.filter(r => r.name !== 'super_admin' && r.name !== 'tenant_admin')

  // Detail view for a specific role
  if (editRole) {
    return (
      <RoleDetail
        role={editRole}
        permissions={permissions}
        onBack={() => setEditRole(null)}
        onUpdate={handleUpdate}
      />
    )
  }

  // List view — all visible roles as cards
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Rollen & Rechten</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            Klik op een rol om de rechten te bewerken
          </p>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleRoles.map(role => {
          const permCount   = role.permissions?.length ?? 0
          const userCount   = role.users_count ?? 0
          const canDelete   = userCount === 0
          return (
            <div key={role.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                       background: 'white', border: '1px solid #F3F4F6', borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-bg)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{role.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {permCount} {permCount === 1 ? 'recht' : 'rechten'} · {userCount} {userCount === 1 ? 'gebruiker' : 'gebruikers'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setEditRole(role)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
                           fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                           border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
                           color: 'var(--color-primary)' }}>
                  Bewerken
                </button>
                <button
                  onClick={() => canDelete && deleteRole(role)}
                  disabled={!canDelete || deleting === role.id}
                  title={canDelete ? 'Rol verwijderen' : `Niet verwijderbaar — ${userCount} ${userCount === 1 ? 'gebruiker heeft' : 'gebruikers hebben'} deze rol. Wijs hen eerst een andere rol toe.`}
                  style={{
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', borderRadius: 8,
                    cursor: canDelete ? 'pointer' : 'not-allowed',
                    background: canDelete ? '#FEF2F2' : '#F9FAFB',
                    color: canDelete ? '#DC2626' : '#D1D5DB',
                  }}
                  onMouseEnter={e => { if (canDelete) e.currentTarget.style.background = '#FEE2E2' }}
                  onMouseLeave={e => { if (canDelete) e.currentTarget.style.background = '#FEF2F2' }}>
                  {deleting === role.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          )
        })}
        {visibleRoles.length === 0 && (
          <p style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0' }}>Nog geen rollen aangemaakt.</p>
        )}
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
  const { user, hasPermission, isSuperAdmin, hasRole } = useAuth()
  const canSync = isSuperAdmin() || hasRole('planner') || hasRole('tenant_admin')
    || hasPermission('sync.refresh') || hasPermission('candidates.sync') || hasPermission('customers.sync')
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
    if (logName === 'http') {
      const method  = p.method ?? '—'
      const status  = p.status
      const isOk    = status >= 200 && status < 300
      const isErr   = status >= 400
      const statusColor = isOk ? '#16A34A' : isErr ? '#DC2626' : '#D97706'
      const statusBg    = isOk ? '#F0FDF4' : isErr ? '#FEF2F2' : '#FFFBEB'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 16px', alignItems: 'start' }}>
            {[
              { label: 'Methode', value: method, mono: true },
              { label: 'Pad',     value: p.path ?? p.url ?? '—', mono: true },
              { label: 'Status',  value: status, statusColor, statusBg },
              { label: 'Duur',    value: p.duration ?? '—' },
            ].map(row => (
              <><span key={row.label + 'l'} style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>{row.label}</span>
              <span key={row.label + 'v'} style={{ fontSize: 13, color: row.statusColor ?? '#111827',
                                  background: row.statusBg ?? 'transparent',
                                  borderRadius: row.statusBg ? 6 : 0,
                                  padding: row.statusBg ? '1px 7px' : 0,
                                  fontFamily: row.mono ? 'monospace' : 'inherit',
                                  fontWeight: row.statusColor ? 700 : 400 }}>
                {row.value ?? '—'}
              </span></>
            ))}
          </div>
          {p.payload && Object.keys(p.payload).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 6 }}>Payload</div>
              <pre style={{ fontSize: 11, fontFamily: 'monospace', background: '#1E1E2E', color: '#A8E6CF',
                             borderRadius: 8, padding: '10px 14px', overflow: 'auto', maxHeight: 200,
                             margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(p.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    }

    if (logName === 'auth') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Actie',    value: p.action ?? entry.description },
            { label: 'IP',       value: p.ip ?? p.ip_address ?? '—' },
            { label: 'Browser',  value: p.user_agent ?? '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                           background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: '#111827', maxWidth: 240,
                              overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )
    }

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
  auth:      { label: 'Auth',            bg: '#EFF6FF', color: '#1D4ED8' },
  http:      { label: 'HTTP',            bg: '#F1F5F9', color: '#475569' },
  sync:      { label: 'Synchronisatie',  bg: '#EFF6FF', color: '#2563EB' },
  roles:     { label: 'Rollen',          bg: '#F5F3FF', color: '#6D28D9' },
  settings:  { label: 'Instellingen',   bg: '#ECFDF5', color: '#059669' },
  users:     { label: 'Gebruikers',      bg: '#FFF7ED', color: '#C2410C' },
  apps:      { label: 'Apps',            bg: '#FFF7ED', color: '#B45309' },
  modules:   { label: 'Modules',         bg: '#F5F3FF', color: '#7C3AED' },
  workflows: { label: 'Workflows',       bg: '#ECFDF5', color: '#0F766E' },
  webhooks:  { label: 'Webhooks',        bg: '#F0F9FF', color: '#0369A1' },
  ai:        { label: 'AI',              bg: '#FDF4FF', color: '#9333EA' },
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
                placeholder="Bijv. KoiosMatch"
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

  const BASE_URL = 'http://koiosmatch-api.test/api/webhook'

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

// ─── Apps ────────────────────────────────────────────────────────────────────

function AppsSettings() {
  const { enabled, setApps } = useApps()
  const auth                        = useAuth()
  const { hasPermission }           = auth
  const [saving, setSaving]         = useState(null)
  const [saved,  setSaved]          = useState(null)
  const canEdit = hasPermission('settings.update')
  // True when the active tenant's package includes connectors (package 3).
  // Super admins can still see and pre-configure connectors for any tenant — the banner
  // below just reminds them that users won't see connectors until the tenant is on pkg 3.
  const tenantHasConnectors = canAccessPage('apps', auth)

  const toggle = async (appId) => {
    if (!canEdit) return
    const newEnabled = enabled.includes(appId)
      ? enabled.filter(id => id !== appId)
      : [...enabled, appId]
    setSaving(appId)
    try {
      await api.put('/settings/apps', { enabled: newEnabled })
      setApps(newEnabled)
      setSaved(appId); setTimeout(() => setSaved(null), 2000)
    } catch {}
    setSaving(null)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Package context banner — shown when the active tenant is NOT on package 3 yet.
          Super admin can still pre-configure connectors; users won't see them until upgraded. */}
      {!tenantHasConnectors && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                      background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, marginBottom: 16 }}>
          <AlertTriangle size={15} color="#0369A1" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0369A1' }}>
              Tenant zit nog niet op Pakket 3
            </div>
            <div style={{ fontSize: 12, color: '#0284C7', marginTop: 2 }}>
              Je kunt connectors alvast instellen, maar ze worden pas zichtbaar voor gebruikers
              nadat je dit tenant-pakket via het tabblad <strong>Modules</strong> naar Pakket 3 upgradet.
            </div>
          </div>
        </div>
      )}

      {/* Cost warning */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                    background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 24 }}>
        <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
            Let op: hier zitten maandelijkse kosten aan verbonden
          </div>
          <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
            Het in- of uitschakelen van apps heeft direct invloed op je factuur. Neem contact op met je accountmanager voor de tarieven.
          </div>
        </div>
      </div>

      {!canEdit && (
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, padding: '10px 14px',
                      background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
          Alleen admins kunnen apps in- of uitschakelen.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AVAILABLE_APPS.map(app => {
          const on = enabled.includes(app.id)
          const isSaving = saving === app.id
          const isSaved  = saved  === app.id
          return (
            <div key={app.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 18px', borderRadius: 12,
              border: `1.5px solid ${on ? app.border : 'var(--border)'}`,
              background: on ? app.bg : 'var(--surface)',
              transition: 'all 0.15s',
              opacity: !canEdit && !on ? 0.6 : 1,
            }}>
              <div style={{ fontSize: 26, flexShrink: 0, width: 44, height: 44, borderRadius: 10,
                             background: on ? app.color + '18' : '#F3F4F6',
                             display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {app.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{app.label}</span>
                  {on && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: app.color,
                                   background: app.color + '18', borderRadius: 999, padding: '1px 7px' }}>
                      Actief
                    </span>
                  )}
                  {app.monthly && (
                    <span style={{ fontSize: 10, color: '#D97706', background: '#FEF3C7',
                                   borderRadius: 999, padding: '1px 7px', fontWeight: 500 }}>
                      Maandelijks
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{app.description}</div>
              </div>
              <button
                onClick={() => toggle(app.id)}
                disabled={!canEdit || isSaving}
                title={!canEdit ? 'Geen rechten' : on ? 'Uitschakelen' : 'Inschakelen'}
                style={{
                  width: 44, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
                  background: on ? app.color : '#D1D5DB',
                  cursor: canEdit ? 'pointer' : 'not-allowed',
                  position: 'relative', transition: 'background 0.2s',
                  opacity: isSaving ? 0.6 : 1,
                }}>
                <div style={{
                  position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  left: on ? 22 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              {isSaved && <Check size={14} color="#16A34A" style={{ flexShrink: 0 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Modules ─────────────────────────────────────────────────────────────────
// Super-admin-only tab. Controls which package/tier a tenant is on.
// Each package maps to a set of accessible_pages that the backend stores.
// 'apps' in the modules list unlocks external integrations (package 3 only).

// Package IDs must match what the backend accepts in PUT /tenant-modules { package }.
// Matrix model: 10 packages × 5 feature dimensions
// col = feature module, row = package
const PACKAGES = [
  { id: 'reporting_sm',        nr: 1,  label: 'Rapportage Shiftmanager',              sm: true,  hf: false, ai: false, ats: false, plan: false },
  { id: 'reporting_hf',        nr: 2,  label: 'Rapportage HelloFlex',                 sm: false, hf: true,  ai: false, ats: false, plan: false },
  { id: 'reporting_sm_hf',     nr: 3,  label: 'Rapportage SM + HF',                   sm: true,  hf: true,  ai: false, ats: false, plan: false },
  { id: 'reporting_sm_ai',     nr: 4,  label: 'Rapportage SM + AI & Workflow',         sm: true,  hf: false, ai: true,  ats: false, plan: false },
  { id: 'reporting_hf_ai',     nr: 5,  label: 'Rapportage HF + AI & Workflow',         sm: false, hf: true,  ai: true,  ats: false, plan: false },
  { id: 'reporting_sm_hf_ai',  nr: 6,  label: 'Rapportage SM + HF + AI & Workflow',   sm: true,  hf: true,  ai: true,  ats: false, plan: false },
  { id: 'ats_crm',             nr: 7,  label: 'ATS & CRM',                            sm: false, hf: false, ai: false, ats: true,  plan: false },
  { id: 'ats_crm_ai',          nr: 8,  label: 'ATS & CRM + AI & Workflow',            sm: false, hf: false, ai: true,  ats: true,  plan: false },
  { id: 'ats_crm_planning',    nr: 9,  label: 'ATS & CRM + Planning',                 sm: false, hf: false, ai: false, ats: true,  plan: true  },
  { id: 'ats_crm_ai_planning', nr: 10, label: 'ATS & CRM + AI & Workflow + Planning', sm: false, hf: false, ai: true,  ats: true,  plan: true  },
]

const MATRIX_COLS = [
  { key: 'sm',   label: 'Shiftmanager',   icon: '📊', color: '#6B7280' },
  { key: 'hf',   label: 'HelloFlex',      icon: '🟡', color: '#0891B2' },
  { key: 'ai',   label: 'AI & Workflow',  icon: '🤖', color: '#7C3AED' },
  { key: 'ats',  label: 'ATS & CRM',      icon: '📋', color: '#059669' },
  { key: 'plan', label: 'Planning',        icon: '📅', color: '#0EA5E9' },
]

const WORKFLOW_APPS = [
  { id: 'shiftmanager', label: 'Shiftmanager', icon: '📊', desc: 'Diensten & bezetting via Shiftmanager API' },
  { id: 'intus',        label: 'Intus',         icon: '🔌', desc: 'Koppeling met Intus planningssoftware' },
  { id: 'helloflex',    label: 'HelloFlex',      icon: '🟡', desc: 'HelloFlex integratie voor uren & plaatsingen' },
  { id: 'afas',         label: 'AFAS',           icon: '💼', desc: 'AFAS Profit koppeling voor HR & salaris' },
  { id: 'bullhorn',     label: 'Bullhorn',       icon: '📣', desc: 'Bullhorn ATS sync' },
  { id: 'google',       label: 'Google Jobs',    icon: '🔍', desc: 'Publiceer vacatures op Google for Jobs' },
]

function MatrixCell({ active }) {
  return (
    <td style={{ textAlign: 'center', padding: '0 4px' }}>
      {active
        ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: '50%', background: '#D1FAE5' }}>
            <Check size={11} color="#059669" />
          </span>
        : <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 1, background: '#E5E7EB' }} />
      }
    </td>
  )
}

function ModulesSettings() {
  const { activeTenant, refreshUser } = useAuth()
  const [currentPkgId, setCurrentPkgId] = useState(null)
  const [selectedId,   setSelectedId]   = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  useEffect(() => {
    if (!activeTenant?.id) return
    setLoading(true)
    api.get('/tenant-modules', { params: { tenant_id: activeTenant.id } })
      .then(res => {
        const pkg = res.data?.package ?? PACKAGES[0].id
        setCurrentPkgId(pkg)
        setSelectedId(pkg)
      })
      .catch(() => {
        setCurrentPkgId(PACKAGES[0].id)
        setSelectedId(PACKAGES[0].id)
      })
      .finally(() => setLoading(false))
  }, [activeTenant?.id])

  const currentPkg = PACKAGES.find(p => p.id === currentPkgId) ?? PACKAGES[0]
  const selected   = PACKAGES.find(p => p.id === selectedId)   ?? PACKAGES[0]
  const hasChange  = selectedId !== currentPkgId

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/tenant-modules', { tenant_id: activeTenant?.id, package: selected.id })
      setCurrentPkgId(selected.id)
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
      <p style={{ fontSize: 13, color: '#9CA3AF' }}>Pakket ophalen…</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Super admin notice */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                    background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, marginBottom: 24 }}>
        <Package size={15} color="#7C3AED" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#5B21B6' }}>Alleen zichtbaar voor super admins</div>
          <div style={{ fontSize: 12, color: '#7C3AED', marginTop: 2 }}>
            Pakket wijzigen heeft direct invloed op de klantfactuur. Elke wijziging wordt gelogd.
          </div>
        </div>
      </div>

      {/* Matrix tabel */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-alt, #F9FAFB)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', width: '40%' }}>
                Pakket
              </th>
              {MATRIX_COLS.map(col => (
                <th key={col.key} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600,
                                            color: col.color, whiteSpace: 'nowrap' }}>
                  <div>{col.icon}</div>
                  <div style={{ marginTop: 2 }}>{col.label}</div>
                </th>
              ))}
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {PACKAGES.map((pkg, i) => {
              const isActive   = currentPkgId === pkg.id
              const isSelected = selectedId   === pkg.id
              return (
                <tr key={pkg.id}
                  onClick={() => setSelectedId(pkg.id)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: i < PACKAGES.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isSelected ? '#EFF6FF' : isActive ? '#F0FDF4' : 'white',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#EFF6FF' : isActive ? '#F0FDF4' : 'white' }}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 22 }}>
                        {pkg.nr}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: isSelected || isActive ? 600 : 400,
                                      color: isSelected ? '#1D4ED8' : '#111827' }}>
                        {pkg.label}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#059669',
                                        background: '#D1FAE5', borderRadius: 999, padding: '1px 7px' }}>
                          Huidig
                        </span>
                      )}
                    </div>
                  </td>
                  {MATRIX_COLS.map(col => <MatrixCell key={col.key} active={pkg[col.key]} />)}
                  <td style={{ textAlign: 'center', paddingRight: 12 }}>
                    {isSelected && (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#1D4ED8',
                                     display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={10} color="white" />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <button onClick={save} disabled={saving || !hasChange}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 20px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
                   background: saved ? '#16A34A' : hasChange ? 'var(--color-primary)' : '#D1D5DB',
                   color: 'white', cursor: (saving || !hasChange) ? 'not-allowed' : 'pointer',
                   transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}>
          {saved  ? <><Check size={13} /> Opgeslagen &amp; actief</>
          : saving ? <><RefreshCw size={13} className="animate-spin" /> Opslaan…</>
          :          <><Save size={13} /> Pakket activeren</>}
        </button>
        {hasChange && !saved && (
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            Wijziging van <strong>{currentPkg.label}</strong> naar <strong>{selected.label}</strong>
          </span>
        )}
      </div>

    </div>
  )
}

// ─── WhatsApp verbinding ──────────────────────────────────────────────────────
// Visible to any user whose tenant has the WhatsApp module (requiresPage: 'whatsapp').
// Shows connection status, linked phone numbers and approved templates.
// API: GET /whatsapp/connection, /whatsapp/phone-numbers, /whatsapp/templates

const QUALITY_META = {
  GREEN:  { label: 'Goed',      color: '#16A34A', bg: '#F0FDF4' },
  YELLOW: { label: 'Matig',     color: '#D97706', bg: '#FFFBEB' },
  RED:    { label: 'Slecht',    color: '#DC2626', bg: '#FEF2F2' },
}

const TEMPLATE_STATUS_META = {
  APPROVED: { label: 'Goedgekeurd', color: '#16A34A', bg: '#F0FDF4' },
  PENDING:  { label: 'In review',   color: '#D97706', bg: '#FFFBEB' },
  REJECTED: { label: 'Afgewezen',   color: '#DC2626', bg: '#FEF2F2' },
  PAUSED:   { label: 'Gepauzeerd',  color: '#6B7280', bg: '#F9FAFB' },
}

const CATEGORY_LABEL = {
  MARKETING:      'Marketing',
  UTILITY:        'Transactioneel',
  AUTHENTICATION: 'Authenticatie',
}

function WhatsAppSettings() {
  const [connection, setConnection] = useState(null)
  const [connId,     setConnId]     = useState(null)
  const [phones,     setPhones]     = useState([])
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [noConn,     setNoConn]     = useState(false)
  const [search,     setSearch]     = useState('')
  const [syncing,    setSyncing]    = useState(null) // 'numbers' | 'templates'
  const [syncMsg,    setSyncMsg]    = useState(null)

  const loadDetail = (id) =>
    api.get(`/whatsapp/${id}`).then(r => {
      const full = r.data?.data ?? r.data
      setPhones(Array.isArray(full?.phone_numbers) ? full.phone_numbers : [])
      setTemplates(Array.isArray(full?.templates) ? full.templates : [])
    })

  useEffect(() => {
    api.get('/whatsapp')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        if (list.length === 0) { setNoConn(true); return }
        const conn = list[0]
        setConnection(conn)
        setConnId(conn.id)
        return loadDetail(conn.id)
      })
      .catch(() => setNoConn(true))
      .finally(() => setLoading(false))
  }, [])

  const syncNumbers = async () => {
    setSyncing('numbers'); setSyncMsg(null)
    try {
      await api.post(`/whatsapp/${connId}/sync-numbers`)
      await loadDetail(connId)
      setSyncMsg({ ok: true, text: 'Nummers gesynchroniseerd' })
    } catch { setSyncMsg({ ok: false, text: 'Synchronisatie mislukt' }) }
    setSyncing(null)
  }

  const syncTemplates = async () => {
    setSyncing('templates'); setSyncMsg(null)
    try {
      await api.post(`/whatsapp/${connId}/sync-templates`)
      await loadDetail(connId)
      setSyncMsg({ ok: true, text: 'Templates gesynchroniseerd' })
    } catch { setSyncMsg({ ok: false, text: 'Synchronisatie mislukt' }) }
    setSyncing(null)
  }

  const filteredTemplates = templates.filter(t => {
    const q = search.trim().toLowerCase()
    return !q || t.name?.toLowerCase().includes(q) || t.language?.toLowerCase().includes(q)
  })

  const STATUS_CONN = {
    active:   { label: 'Verbonden',      dotColor: '#16A34A', border: '#86EFAC', bg: '#F0FDF4', labelColor: '#16A34A' },
    inactive: { label: 'Inactief',       dotColor: '#9CA3AF', border: '#E5E7EB', bg: '#F9FAFB', labelColor: '#6B7280' },
    expired:  { label: 'Token verlopen', dotColor: '#DC2626', border: '#FCA5A5', bg: '#FEF2F2', labelColor: '#DC2626' },
  }
  const cs = connection ? (STATUS_CONN[connection.status] ?? STATUS_CONN.inactive) : null

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <p style={{ fontSize: 13, color: '#9CA3AF' }}>WhatsApp gegevens ophalen…</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 800 }}>

      {/* ── Connection status ── */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Verbinding</h3>
        {noConn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
                        background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>Niet verbonden</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                Er is nog geen WhatsApp Business-koppeling geconfigureerd voor deze tenant.
              </div>
            </div>
          </div>
        ) : cs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                          background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cs.dotColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: cs.labelColor }}>{cs.label}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {connection.provider && (
                    <span style={{ textTransform: 'capitalize', marginRight: 8 }}>{connection.provider}</span>
                  )}
                  {connection.waba_id && (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>
                      WABA: {connection.waba_id}
                    </span>
                  )}
                </div>
              </div>
              {connection.last_checked_at && (
                <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                  Gecontroleerd {new Date(connection.last_checked_at).toLocaleDateString('nl-NL')}
                </div>
              )}
            </div>
        ) : (
          <div style={{ padding: '16px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB',
                        borderRadius: 12, fontSize: 13, color: '#6B7280' }}>
            Verbindingsstatus niet beschikbaar
          </div>
        )}
      </div>

      {syncMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 12,
                      background: syncMsg.ok ? '#F0FDF4' : '#FEF2F2',
                      color: syncMsg.ok ? '#16A34A' : '#DC2626',
                      border: `1px solid ${syncMsg.ok ? '#86EFAC' : '#FCA5A5'}` }}>
          {syncMsg.text}
        </div>
      )}

      {/* ── Phone numbers ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Telefoonnummers
            {phones.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#9CA3AF' }}>
                {phones.length} gekoppeld
              </span>
            )}
          </h3>
          {connId && (
            <button onClick={syncNumbers} disabled={syncing === 'numbers'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
                       fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                       border: '1px solid #E5E7EB', background: 'white', color: '#374151' }}>
              <RefreshCw size={11} style={{ animation: syncing === 'numbers' ? 'spin 1s linear infinite' : 'none' }} />
              Synchroniseren
            </button>
          )}
        </div>
        {phones.length === 0 ? (
          <div style={{ padding: '16px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB',
                        borderRadius: 12, fontSize: 13, color: '#9CA3AF' }}>
            Geen telefoonnummers gevonden
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phones.map((p, i) => {
              const q = QUALITY_META[p.quality_rating] ?? QUALITY_META.GREEN
              return (
                <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14,
                                               padding: '14px 18px', background: 'white',
                                               border: '1px solid #F3F4F6', borderRadius: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={16} color="#16A34A" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                      {p.name ?? p.display_number}
                    </div>
                    {p.display_number && (
                      <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>
                        {p.display_number}
                      </div>
                    )}
                  </div>
                  {p.quality_rating && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: q.color, background: q.bg,
                                   borderRadius: 999, padding: '2px 10px', flexShrink: 0 }}>
                      Kwaliteit: {q.label}
                    </span>
                  )}
                  {p.code_verification_status && (
                    <span style={{ fontSize: 11, color: '#6B7280', background: '#F9FAFB',
                                   borderRadius: 999, padding: '2px 10px', flexShrink: 0,
                                   border: '1px solid #E5E7EB' }}>
                      {p.code_verification_status}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Templates ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Templates
            {templates.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#9CA3AF' }}>
                {templates.length} totaal
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {connId && (
              <button onClick={syncTemplates} disabled={syncing === 'templates'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
                         fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                         border: '1px solid #E5E7EB', background: 'white', color: '#374151' }}>
                <RefreshCw size={11} style={{ animation: syncing === 'templates' ? 'spin 1s linear infinite' : 'none' }} />
                Synchroniseren
              </button>
            )}
            {templates.length > 0 && (
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%',
                                            transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Zoek template…"
                  style={{ height: 30, paddingLeft: 24, paddingRight: 10, fontSize: 12, width: 180,
                           border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
              </div>
            )}
          </div>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding: '16px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB',
                        borderRadius: 12, fontSize: 13, color: '#9CA3AF' }}>
            Geen templates gevonden
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Naam', 'Categorie', 'Taal', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                                          color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em',
                                          borderBottom: '1px solid #F3F4F6' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center',
                                                fontSize: 13, color: '#9CA3AF' }}>
                    Geen resultaten
                  </td></tr>
                )}
                {filteredTemplates.map((t, i) => {
                  const s = TEMPLATE_STATUS_META[t.status] ?? TEMPLATE_STATUS_META.PENDING
                  const bodyText = Array.isArray(t.components)
                    ? t.components.find(c => c.type === 'BODY')?.text
                    : null
                  return (
                    <tr key={t.id ?? i}
                      style={{ borderBottom: '1px solid #F9FAFB' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', fontFamily: 'monospace' }}>
                          {t.name}
                        </div>
                        {bodyText && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2,
                                         maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bodyText}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#6B7280' }}>
                        {CATEGORY_LABEL[t.category] ?? t.category ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#6B7280' }}>
                        {t.language ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg,
                                        borderRadius: 999, padding: '2px 8px' }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Security / MFA settings ─────────────────────────────────────────────────
// Shows the user's MFA status and lets them enable (setup QR → confirm → show
// recovery codes) or disable (re-enter TOTP code) two-factor authentication.

function SecuritySettings() {
  const { user, setupMfa, confirmMfa, disableMfa, refreshUser } = useAuth()
  // 'idle' | 'setup' | 'confirm' | 'recovery' | 'disabling'
  const [step,          setStep]          = useState('idle')
  const [otpauthUrl,    setOtpauthUrl]    = useState('')
  const [secret,        setSecret]        = useState('')
  const [code,          setCode]          = useState('')
  const [disableCode,   setDisableCode]   = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState(false)

  const mfaEnabled = user?.mfa_enabled === true

  const reset = () => { setStep('idle'); setCode(''); setDisableCode(''); setError(''); setOtpauthUrl(''); setSecret('') }

  // ── Enable flow ─────────────────────────────────────────────────────────────
  const startSetup = async () => {
    setLoading(true); setError('')
    try {
      const data = await setupMfa()
      setOtpauthUrl(data.otpauth_url ?? '')
      setSecret(data.secret ?? '')
      setStep('setup')
    } catch { setError('Kon MFA setup niet starten.') }
    setLoading(false)
  }

  const confirmSetup = async (e) => {
    e.preventDefault()
    if (code.replace(/\D/g, '').length < 6) return
    setLoading(true); setError('')
    try {
      const data = await confirmMfa(code.replace(/\D/g, ''))
      setRecoveryCodes(data.recovery_codes ?? [])
      await refreshUser()
      setStep('recovery')
    } catch (err) {
      setError(err.response?.data?.message || 'Ongeldige code. Probeer opnieuw.')
      setCode('')
    }
    setLoading(false)
  }

  // ── Disable flow ────────────────────────────────────────────────────────────
  const handleDisable = async (e) => {
    e.preventDefault()
    if (disableCode.replace(/\D/g, '').length < 6) return
    setLoading(true); setError('')
    try {
      await disableMfa(disableCode.replace(/\D/g, ''))
      reset()
    } catch (err) {
      setError(err.response?.data?.message || 'Ongeldige code.')
      setDisableCode('')
    }
    setLoading(false)
  }

  const copyRecovery = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Recovery codes view (shown once after setup) ────────────────────────────
  if (step === 'recovery') return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, marginBottom: 24 }}>
        <ShieldCheck size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>Twee-factor verificatie geactiveerd</div>
          <div style={{ fontSize: 12, color: '#16A34A', marginTop: 2 }}>
            Sla je herstelcodes op. Ze zijn slechts één keer bruikbaar en worden niet opnieuw getoond.
          </div>
        </div>
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Herstelcodes</h3>
      <div style={{ background: '#1E1E2E', borderRadius: 10, padding: '16px 20px', marginBottom: 16,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
        {recoveryCodes.map(c => (
          <span key={c} style={{ fontFamily: 'monospace', fontSize: 13, color: '#A8E6CF', letterSpacing: '0.05em' }}>{c}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={copyRecovery}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                   border: '1px solid #E5E7EB', background: 'white', color: '#374151' }}>
          <Copy size={13} /> {copied ? 'Gekopieerd!' : 'Kopiëren'}
        </button>
        <button onClick={reset}
          style={{ height: 34, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   cursor: 'pointer', border: 'none', background: 'var(--color-primary)', color: 'white' }}>
          Klaar
        </button>
      </div>
    </div>
  )

  // ── QR + secret view ────────────────────────────────────────────────────────
  if (step === 'setup') return (
    <div style={{ maxWidth: 420 }}>
      <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                                        color: '#6B7280', background: 'none', border: 'none',
                                        cursor: 'pointer', padding: 0, marginBottom: 20 }}>
        <ArrowLeft size={13} /> Terug
      </button>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Scan de QR-code</h3>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
        Open je authenticator app (Google Authenticator, Microsoft Authenticator, Bitwarden, etc.)
        en scan de onderstaande QR-code.
      </p>
      {otpauthUrl && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ padding: 12, background: 'white', border: '1px solid #E5E7EB', borderRadius: 12 }}>
            <QRCodeSVG value={otpauthUrl} size={180} />
          </div>
        </div>
      )}
      {secret && (
        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                       textAlign: 'center', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.12em', color: '#374151' }}>
          {secret}
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, fontFamily: 'inherit', letterSpacing: 0 }}>
            Handmatige invoer
          </div>
        </div>
      )}
      <form onSubmit={confirmSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Verificatiecode uit de app
          </label>
          <input type="text" inputMode="numeric" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456" maxLength={6} required autoFocus
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 8,
                     fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: '#111827',
                     boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
        </div>
        {error && (
          <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2',
                         border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading || code.length < 6}
          style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   border: 'none', cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer',
                   background: (loading || code.length < 6) ? '#D1D5DB' : 'var(--color-primary)', color: 'white' }}>
          {loading ? 'Bezig…' : 'Bevestigen en activeren'}
        </button>
      </form>
    </div>
  )

  // ── Disable confirm view ─────────────────────────────────────────────────────
  if (step === 'disabling') return (
    <div style={{ maxWidth: 420 }}>
      <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                                        color: '#6B7280', background: 'none', border: 'none',
                                        cursor: 'pointer', padding: 0, marginBottom: 20 }}>
        <ArrowLeft size={13} /> Terug
      </button>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
        Twee-factor verificatie uitschakelen
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
        Voer je huidige verificatiecode in om 2FA uit te schakelen.
      </p>
      <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="text" inputMode="numeric" value={disableCode}
          onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456" maxLength={6} required autoFocus
          style={{ padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 8,
                   fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', color: '#111827' }}
          onFocus={e => (e.target.style.borderColor = '#DC2626')}
          onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
        {error && (
          <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2',
                         border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading || disableCode.length < 6}
          style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                   border: 'none', cursor: (loading || disableCode.length < 6) ? 'not-allowed' : 'pointer',
                   background: (loading || disableCode.length < 6) ? '#D1D5DB' : '#DC2626', color: 'white' }}>
          {loading ? 'Bezig…' : '2FA uitschakelen'}
        </button>
      </form>
    </div>
  )

  // ── Idle view — status + action ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ padding: '20px', background: 'white', border: '1px solid #F3F4F6',
                    borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: mfaEnabled ? '#F0FDF4' : '#F9FAFB' }}>
          {mfaEnabled
            ? <ShieldCheck size={22} color="#16A34A" />
            : <Lock size={22} color="#9CA3AF" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
            Twee-factor verificatie (2FA)
          </div>
          <div style={{ fontSize: 12, color: mfaEnabled ? '#16A34A' : '#9CA3AF', marginTop: 2 }}>
            {mfaEnabled ? 'Ingeschakeld — je account is extra beveiligd' : 'Uitgeschakeld — voeg een extra beveiligingslaag toe'}
          </div>
        </div>
        {mfaEnabled
          ? (
            <button onClick={() => { setStep('disabling'); setError('') }}
              style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                       cursor: 'pointer', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', flexShrink: 0 }}>
              Uitschakelen
            </button>
          ) : (
            <button onClick={startSetup} disabled={loading}
              style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8,
                       cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
                       background: 'var(--color-primary)', color: 'white', flexShrink: 0 }}>
              {loading ? 'Bezig…' : 'Inschakelen'}
            </button>
          )
        }
      </div>
      {error && (
        <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5',
                       borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 20, padding: '14px 16px', background: '#F9FAFB',
                    border: '1px solid #F3F4F6', borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          Ondersteunde apps
        </div>
        {['Google Authenticator', 'Microsoft Authenticator', 'Bitwarden', 'Authy', '1Password'].map(app => (
          <div key={app} style={{ fontSize: 12, color: '#6B7280', padding: '3px 0' }}>· {app}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Kleurenpalet voor status/fase pickers ───────────────────────────────────

const COLOR_PRESETS = [
  '#EF4444','#F97316','#F59E0B','#84CC16','#22C55E','#14B8A6',
  '#3B8FD4','#6366F1','#8B5CF6','#EC4899','#6B7280','#111827',
]

function ColorPickerPopup({ color, onChange, onClose }) {
  const [hex, setHex] = useState(color)
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  const apply = (c) => { setHex(c); onChange(c) }
  return (
    <div ref={ref} style={{ position: 'absolute', zIndex: 100, background: 'white', border: '1px solid #E5E7EB',
                             borderRadius: 10, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', top: 36, left: 0, width: 192 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => apply(c)}
            style={{ width: 24, height: 24, borderRadius: 6, background: c, border: c === hex ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer' }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="color" value={hex} onChange={e => apply(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
        <input value={hex} onChange={e => { setHex(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(e.target.value) }}
          style={{ flex: 1, height: 28, padding: '0 8px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, fontFamily: 'monospace', outline: 'none' }} />
      </div>
    </div>
  )
}

function ColorSwatch({ color, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: 28, height: 28, borderRadius: 6, background: color, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
      {open && <ColorPickerPopup color={color} onChange={c => { onChange(c) }} onClose={() => setOpen(false)} />}
    </div>
  )
}

function ColorBadge({ label, color }) {
  const bg  = color + '22'
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                   background: bg, color: color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  )
}

// ─── Drag-reorder list ───────────────────────────────────────────────────────

function DragList({ items, onReorder, renderItem }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const handleDrop = () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) { setDragIdx(null); setOverIdx(null); return }
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    onReorder(next)
    setDragIdx(null); setOverIdx(null)
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id ?? i}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={e => { e.preventDefault(); setOverIdx(i) }}
          onDrop={handleDrop}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                   borderBottom: '1px solid #F3F4F6', opacity: dragIdx === i ? 0.4 : 1,
                   background: overIdx === i && dragIdx !== i ? '#F0F9FF' : 'transparent',
                   borderRadius: 6, transition: 'background 0.1s' }}>
          <GripVertical size={14} style={{ color: '#D1D5DB', cursor: 'grab', flexShrink: 0 }} />
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  )
}

// ─── Profiel ─────────────────────────────────────────────────────────────────

function ProfielSettings() {
  const { user } = useAuth()
  const [name,    setName]    = useState(user?.name ?? '')
  const [email,   setEmail]   = useState(user?.email ?? '')
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/profile', { name, email })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Profiel</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Beheer je persoonlijke gegevens</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> Opgeslagen</> : saving ? <><RefreshCw size={13} className="animate-spin"/> Opslaan…</> : <><Save size={13}/> Opslaan</>}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Naam', value: name, set: setName, type: 'text' },
          { label: 'E-mailadres', value: email, set: setEmail, type: 'email' },
        ].map(f => (
          <div key={f.label} style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{f.label}</div>
            <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
              style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 14, border: '1px solid #E5E7EB',
                       borderRadius: 8, outline: 'none', color: '#111827' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Persoonlijke e-mail notificaties ────────────────────────────────────────

function PlaceholderSettings({ title, description }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 260, color: '#9CA3AF', gap: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  )
}

// ─── Bedrijf Algemeen ─────────────────────────────────────────────────────────

const INDUSTRIES = ['Werving','Uitzendbureau','Horeca','Logistiek','Zorg','IT','Bouw','Onderwijs','Financiën','Overig']
const LANGUAGES  = ['Nederlands','Engels','Duits','Frans']
const CURRENCIES = ['Euro (€)','Dollar ($)','Pond (£)']
const TIMEZONES  = ['Europa/Amsterdam','Europa/Brussel','Europa/Londen','UTC']
const COUNTRIES  = ['Netherlands','Belgium','Germany','United Kingdom']

const COMPANY_KEYS = ['company_name','company_industry','company_country','company_address1','company_address2','company_postcode','company_city','company_province','company_language','company_currency','company_timezone','logo_url','company_banner_url']

function BedrijfAlgemeenSettings() {
  const [form,       setForm]       = useState({ company_name:'', company_industry:'', company_country:'Netherlands', company_address1:'', company_address2:'', company_postcode:'', company_city:'', company_province:'', company_language:'Nederlands', company_currency:'Euro (€)', company_timezone:'Europa/Amsterdam' })
  const [logoUrl,    setLogoUrl]    = useState(null)
  const [bannerUrl,  setBannerUrl]  = useState(null)
  const [saved,      setSaved]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [loading,    setLoading]    = useState(true)
  const logoRef   = useRef(null)
  const bannerRef = useRef(null)

  useEffect(() => {
    loadSettings().then(s => {
      setForm(f => ({
        ...f,
        company_name:     s.company_name     ?? '',
        company_industry: s.company_industry ?? '',
        company_country:  s.company_country  ?? 'Netherlands',
        company_address1: s.company_address1 ?? '',
        company_address2: s.company_address2 ?? '',
        company_postcode: s.company_postcode ?? '',
        company_city:     s.company_city     ?? '',
        company_province: s.company_province ?? '',
        company_language: s.company_language ?? 'Nederlands',
        company_currency: s.company_currency ?? 'Euro (€)',
        company_timezone: s.company_timezone ?? 'Europa/Amsterdam',
      }))
      if (s.logo_url)            setLogoUrl(s.logo_url)
      if (s.company_banner_url)  setBannerUrl(s.company_banner_url)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('logo', file)
    try {
      const res = await api.post('/settings/logo', fd)
      if (res.data?.logo_url) setLogoUrl(res.data.logo_url)
    } catch {}
  }

  const handleBannerFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setLoading(true)
    try {
      const url = URL.createObjectURL(file)
      setBannerUrl(url)
      await saveSettings({ company_banner_url: url })
    } catch {} finally { setLoading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (logoUrl)   payload.logo_url           = logoUrl
      if (bannerUrl) payload.company_banner_url = bannerUrl
      await saveSettings(payload)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #F9FAFB', gap: 24 }}>
      <div style={{ width: 200, flexShrink: 0, fontSize: 13, color: '#6B7280', paddingTop: 8 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )

  const Input = ({ k, ...props }) => (
    <input value={form[k]} onChange={e => set(k, e.target.value)} {...props}
      style={{ height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#111827', width: '100%', maxWidth: 360 }} />
  )

  const Select = ({ k, options }) => (
    <select value={form[k]} onChange={e => set(k, e.target.value)}
      style={{ height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#111827', width: '100%', maxWidth: 360, background: 'white' }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Bedrijf</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Beheer je bedrijfsgegevens, teams en voorkeuren.</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> Opgeslagen</> : saving ? <><RefreshCw size={13} className="animate-spin"/> Opslaan…</> : <><Save size={13}/> Opslaan</>}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF' }}>Laden…</p>}

      {!loading && (
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12, padding: '0 24px' }}>
          <Row label="Bedrijfslogo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building2 size={18} style={{ color: '#9CA3AF' }} />}
              </div>
              <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
              <button onClick={() => logoRef.current?.click()} style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: 'pointer', color: '#374151' }}>Uploaden</button>
              {logoUrl && <button onClick={() => setLogoUrl(null)} style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: 'pointer', color: '#374151' }}>Verwijderen</button>}
            </div>
          </Row>
          <Row label="Bedrijfsbanner">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bannerUrl && <img src={bannerUrl} alt="" style={{ width: '100%', maxWidth: 400, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #F3F4F6' }} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerFile} />
                <button onClick={() => bannerRef.current?.click()} style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: 'pointer', color: '#374151' }}>Uploaden</button>
                {bannerUrl && <button onClick={() => setBannerUrl(null)} style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: 'pointer', color: '#374151' }}>Verwijderen</button>}
              </div>
            </div>
          </Row>
          <Row label="Bedrijfsnaam"><Input k="company_name" placeholder="Bedrijfsnaam" /></Row>
          <Row label="Industrie"><Select k="company_industry" options={INDUSTRIES} /></Row>
          <Row label="Land"><Select k="company_country" options={COUNTRIES} /></Row>
          <Row label="Adresregel 1"><Input k="company_address1" placeholder="Straat en huisnummer" /></Row>
          <Row label="Adresregel 2 (optioneel)"><Input k="company_address2" placeholder="" /></Row>
          <Row label="Postcode"><Input k="company_postcode" placeholder="1234 AB" /></Row>
          <Row label="Plaats"><Input k="company_city" placeholder="Stad" /></Row>
          <Row label="Provincie"><Input k="company_province" placeholder="Provincie" /></Row>
          <Row label="Taal"><Select k="company_language" options={LANGUAGES} /></Row>
          <Row label="Valuta"><Select k="company_currency" options={CURRENCIES} /></Row>
          <Row label="Tijdzone"><Select k="company_timezone" options={TIMEZONES} /></Row>
        </div>
      )}
    </div>
  )
}

// ─── Locaties ─────────────────────────────────────────────────────────────────

function LocatiesSettings() {
  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState({ name: '', address: '' })
  const [saving,    setSaving]    = useState(false)
  const [page,      setPage]      = useState(1)
  const PER_PAGE = 10

  useEffect(() => {
    api.get('/locations').then(r => setLocations(r.data?.data ?? r.data ?? []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/locations', form)
      setLocations(p => [res.data, ...p])
      setShowModal(false); setForm({ name: '', address: '' })
    } catch {} finally { setSaving(false) }
  }

  const paginated = locations.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(locations.length / PER_PAGE)

  const TH = { padding: '8px 14px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'left', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }
  const TD = { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F9FAFB' }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Locaties</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Beheer al je kantoren en locaties op één plek.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB',
                   background: 'white', cursor: 'pointer', color: '#374151' }}>
          <Plus size={13} /> Locatie aanmaken
        </button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Laden…</p> : (
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Naam</th>
                <th style={TH}>Adres</th>
                <th style={TH}>Gemaakt op</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={3} style={{ ...TD, textAlign: 'center', color: '#9CA3AF', padding: '32px 0' }}>Nog geen locaties.</td></tr>
              ) : paginated.map((loc, i) => (
                <tr key={loc.id ?? i}>
                  <td style={{ ...TD, fontWeight: 500, color: '#111827' }}>{loc.name}</td>
                  <td style={TD}>{loc.address ?? loc.full_address ?? '—'}</td>
                  <td style={{ ...TD, color: '#9CA3AF', fontSize: 12 }}>
                    {loc.created_at ? new Date(loc.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid #F3F4F6' }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#D1D5DB' : '#374151' }}>
                Vorige
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#D1D5DB' : '#374151' }}>
                Volgende
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Locatie aanmaken</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
            </div>
            {[{ label: 'Naam', key: 'name', placeholder: 'Locatienaam' }, { label: 'Adres', key: 'address', placeholder: 'Volledig adres' }].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{f.label}</div>
                <input value={form[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Annuleren</button>
              <button onClick={create} disabled={saving || !form.name.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: form.name.trim() ? 1 : 0.4 }}>
                {saving ? 'Opslaan…' : 'Aanmaken'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Geheugen ─────────────────────────────────────────────────────────────────

function GeheugenSettings() {
  const [notes,   setNotes]   = useState('')
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings().then(s => { if (s.memory_notes) setNotes(s.memory_notes) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try { await saveSettings({ memory_notes: notes }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch {} finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Geheugen</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Sla notities en context op die door het hele systeem beschikbaar zijn.</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> Opgeslagen</> : saving ? <><RefreshCw size={13} className="animate-spin"/> Opslaan…</> : <><Save size={13}/> Opslaan</>}
        </button>
      </div>
      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Laden…</p> : (
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Voeg hier notities, context of instructies toe…"
          style={{ width: '100%', minHeight: 220, padding: 14, fontSize: 13, border: '1px solid #E5E7EB',
                   borderRadius: 10, outline: 'none', resize: 'vertical', color: '#111827', fontFamily: 'inherit', lineHeight: 1.6 }} />
      )}
    </div>
  )
}

// ─── Generic status/list editor ───────────────────────────────────────────────

function StatusListEditor({ title, subtitle, endpoint, addLabel, withColor = true, withSave = true }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [draft,     setDraft]     = useState({ name: '', color: '#3B8FD4' })
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [deleting,  setDeleting]  = useState(null)

  useEffect(() => {
    api.get(endpoint).then(r => setItems(r.data?.data ?? r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [endpoint])

  const create = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      const res = await api.post(endpoint, draft)
      setItems(p => [...p, res.data])
      setShowModal(false); setDraft({ name: '', color: '#3B8FD4' })
    } catch {} finally { setSaving(false) }
  }

  const remove = async (item) => {
    if (!confirm(`"${item.name}" verwijderen?`)) return
    setDeleting(item.id)
    try { await api.delete(`${endpoint}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
    catch {} finally { setDeleting(null) }
  }

  const updateColor = async (item, color) => {
    setItems(p => p.map(x => x.id === item.id ? { ...x, color } : x))
    try { await api.put(`${endpoint}/${item.id}`, { ...item, color }) } catch {}
  }

  const saveOrder = async () => {
    setSaving(true)
    try {
      await api.put(`${endpoint}/reorder`, { ids: items.map(x => x.id) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {withSave && (
            <button onClick={saveOrder} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                       fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                       background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white' }}>
              {saved ? <><Check size={13}/> Opgeslagen</> : <><Save size={13}/> Opslaan</>}
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB',
                     background: 'white', cursor: 'pointer', color: '#374151' }}>
            <Plus size={13} /> {addLabel}
          </button>
        </div>
      </div>

      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Laden…</p> : (
        <DragList
          items={items}
          onReorder={setItems}
          renderItem={(item) => (
            <>
              {withColor && <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />}
              {withColor
                ? <ColorBadge label={item.name} color={item.color ?? '#6B7280'} />
                : <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{item.name}</span>}
              <div style={{ flex: 1 }} />
              <button onClick={() => remove(item)} disabled={deleting === item.id}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#DC2626' }}>
                {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </>
          )}
        />
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{addLabel}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>Naam</div>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="Naam"
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {withColor && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>Kleur</div>
                <ColorSwatch color={draft.color} onChange={c => setDraft(d => ({ ...d, color: c }))} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Annuleren</button>
              <button onClick={create} disabled={saving || !draft.name.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: draft.name.trim() ? 1 : 0.4 }}>
                {saving ? 'Opslaan…' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Fasen ────────────────────────────────────────────────────────────────────

function FasenSettings() {
  return <StatusListEditor title="Fasen" subtitle="Beheer de fasen van je workflow en welke acties er in elke fase beschikbaar zijn." endpoint="/phases" addLabel="Fase toevoegen" withColor />
}

// ─── Kandidaatstatus ──────────────────────────────────────────────────────────

function KandidaatstatusSettings() {
  return <StatusListEditor title="Kandidaatstatus" subtitle="Beheer de status van je kandidaten en beheer hun beschikbaarheid." endpoint="/candidate-statuses" addLabel="Status toevoegen" withColor />
}

// ─── Vacature ─────────────────────────────────────────────────────────────────

function VacatureSettings() {
  const [customFields, setCustomFields] = useState([])
  const [newField,     setNewField]     = useState('')
  const [addingField,  setAddingField]  = useState(false)

  const addField = async () => {
    if (!newField.trim()) return
    setAddingField(true)
    try {
      const res = await api.post('/vacancy-custom-fields', { name: newField.trim() })
      setCustomFields(p => [...p, res.data])
      setNewField('')
    } catch {} finally { setAddingField(false) }
  }

  useEffect(() => {
    api.get('/vacancy-custom-fields').then(r => setCustomFields(r.data?.data ?? r.data ?? [])).catch(() => {})
  }, [])

  return (
    <div>
      <StatusListEditor title="Vacature" subtitle="Beheer vacaturestatussen en vooraf ingestelde aangepaste veldnamen." endpoint="/vacancy-statuses" addLabel="Status toevoegen" withColor />

      <div style={{ marginTop: 32, maxWidth: 640 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Aangepaste velden</h3>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>Stel veldnamen in die op elke vacature verschijnen om aangepaste velden makkelijker in te vullen.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {customFields.map((f, i) => (
            <div key={f.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'white', border: '1px solid #F3F4F6', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{f.name}</span>
              <button onClick={async () => { await api.delete(`/vacancy-custom-fields/${f.id}`); setCustomFields(p => p.filter(x => x.id !== f.id)) }}
                style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#DC2626' }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={addField}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #D1D5DB', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#9CA3AF' }}>
            <Plus size={14} />
          </button>
          {newField !== undefined && (
            <input value={newField} onChange={e => setNewField(e.target.value)} placeholder="Veldnaam…"
              onKeyDown={e => e.key === 'Enter' && addField()}
              style={{ height: 32, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 7, outline: 'none', color: '#111827' }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Afwijsredenen ────────────────────────────────────────────────────────────

function AfwijsredenenSettings() {
  return <StatusListEditor title="Afwijsredenen" subtitle="Beheer de redenen voor de afwijzing van je sollicitaties." endpoint="/rejection-reasons" addLabel="Reden toevoegen" withColor={false} />
}

// ─── Importeren ───────────────────────────────────────────────────────────────

const IMPORT_TYPES = [
  { id: 'candidates', label: 'Kandidaten', icon: Users },
  { id: 'cvs',        label: "CV's",       icon: FileText },
  { id: 'vacancies',  label: 'Vacatures',  icon: Briefcase },
]

function ImporterenSettings() {
  const [type,   setType]   = useState('candidates')
  const [step,   setStep]   = useState(1)
  const [file,   setFile]   = useState(null)
  const [drag,   setDrag]   = useState(false)
  const fileRef = useRef(null)

  const TOTAL_STEPS = 4

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) { setFile(f); setStep(2) }
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setStep(2) }
  }

  const reset = () => { setFile(null); setStep(1) }

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      {/* Sub-nav */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #F3F4F6', paddingRight: 16, marginRight: 32 }}>
        {IMPORT_TYPES.map(t => {
          const Icon = t.icon
          const active = type === t.id
          return (
            <button key={t.id} onClick={() => { setType(t.id); reset() }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                       borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                       fontWeight: active ? 600 : 400, marginBottom: 2,
                       background: active ? 'var(--color-primary-bg)' : 'transparent',
                       color: active ? 'var(--color-primary)' : '#374151' }}>
              <Icon size={14} style={{ color: active ? 'var(--color-primary)' : '#9CA3AF' }} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {IMPORT_TYPES.find(t => t.id === type)?.label} importeren
          </h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            Importeer je bestaande {IMPORT_TYPES.find(t => t.id === type)?.label.toLowerCase()}gegevens met een CSV-bestand.
          </p>
        </div>

        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Importeer je bestand</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Huidige stap: <strong>{step}</strong> / {TOTAL_STEPS}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(s => Math.max(1, s-1))} disabled={step === 1}
                style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: step === 1 ? 'not-allowed' : 'pointer', color: step === 1 ? '#D1D5DB' : '#374151' }}>
                Terug
              </button>
              <button onClick={() => { if (step === 1 && !file) { fileRef.current?.click(); return } setStep(s => Math.min(TOTAL_STEPS, s+1)) }}
                disabled={step === TOTAL_STEPS}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: step === TOTAL_STEPS ? 'not-allowed' : 'pointer', opacity: step === TOTAL_STEPS ? 0.5 : 1 }}>
                Volgende
              </button>
            </div>
          </div>

          {step === 1 && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              style={{ border: `2px dashed ${drag ? 'var(--color-primary)' : '#E5E7EB'}`, borderRadius: 10,
                       minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
                       justifyContent: 'center', gap: 12, cursor: 'pointer', background: drag ? 'var(--color-primary-bg)' : '#FAFAFA',
                       transition: 'all 0.15s' }}
              onClick={() => fileRef.current?.click()}>
              <CloudUpload size={32} style={{ color: '#9CA3AF' }} />
              <span style={{ fontSize: 13, color: '#6B7280' }}>Sleep je bestanden hierheen</span>
              <button onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                Selecteer CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          )}

          {step === 2 && (
            <div style={{ padding: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginBottom: 16 }}>
                <Check size={14} style={{ color: '#16A34A' }} />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>{file?.name}</span>
                <button onClick={reset} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={13} /></button>
              </div>
              <p style={{ fontSize: 13, color: '#6B7280' }}>Bestand geselecteerd. Klik op <strong>Volgende</strong> om de kolommen te koppelen.</p>
            </div>
          )}

          {step === 3 && (
            <div style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>Koppel de kolommen uit je CSV aan de systeemvelden.</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>Kolomkoppeling wordt na upload geconfigureerd.</p>
            </div>
          )}

          {step === 4 && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Check size={40} style={{ color: '#16A34A', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Import klaar!</p>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Je gegevens zijn succesvol geïmporteerd.</p>
              <button onClick={reset} style={{ marginTop: 16, height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Nieuw importeren</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── API-keys ─────────────────────────────────────────────────────────────────

function ApiKeysSettings() {
  const [keys,     setKeys]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newKey,   setNewKey]   = useState(null)

  useEffect(() => {
    api.get('/api-keys').then(r => setKeys(r.data?.data ?? r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/api-keys', { name: newName.trim() })
      setNewKey(res.data?.key ?? res.data?.token)
      setKeys(p => [...p, res.data])
      setNewName('')
    } catch {} finally { setCreating(false) }
  }

  const revoke = async (k) => {
    if (!confirm(`API-key "${k.name}" intrekken?`)) return
    try { await api.delete(`/api-keys/${k.id}`); setKeys(p => p.filter(x => x.id !== k.id)) } catch {}
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>API-keys</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Beheer API-sleutels voor externe koppelingen.</p>
        </div>
      </div>

      {newKey && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6 }}>Nieuwe API-key — kopieer deze nu, hij wordt niet meer getoond.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', background: 'white', border: '1px solid #D1FAE5', borderRadius: 6, padding: '6px 10px', color: '#111827', overflow: 'auto' }}>{newKey}</code>
            <button onClick={() => navigator.clipboard.writeText(newKey)} style={{ height: 30, padding: '0 10px', fontSize: 12, border: '1px solid #D1FAE5', borderRadius: 6, background: 'white', cursor: 'pointer' }}><Copy size={12} /></button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>Sluiten</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Naam voor de API-key…"
          onKeyDown={e => e.key === 'Enter' && create()}
          style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }} />
        <button onClick={create} disabled={creating || !newName.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: newName.trim() ? 1 : 0.4 }}>
          <Plus size={13} /> Aanmaken
        </button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Laden…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF' }}>Nog geen API-keys aangemaakt.</p>}
          {keys.map((k, i) => (
            <div key={k.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'white', border: '1px solid #F3F4F6', borderRadius: 10 }}>
              <Key size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{k.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  Aangemaakt: {k.created_at ? new Date(k.created_at).toLocaleDateString('nl-NL') : '—'}
                  {k.last_used_at && ` · Gebruikt: ${new Date(k.last_used_at).toLocaleDateString('nl-NL')}`}
                </div>
              </div>
              <button onClick={() => revoke(k)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', fontSize: 12, border: '1px solid #FCA5A5', borderRadius: 7, background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}>
                <Trash2 size={11} /> Intrekken
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── App Store ────────────────────────────────────────────────────────────────

function AppStoreSettings() {
  return <PlaceholderSettings title="App store" description="Beheer en installeer apps en integraties." />
}

// ─── Notificaties ─────────────────────────────────────────────────────────────

function NotificatiesSettings({ context }) {
  const LABELS = {
    sollicitaties: { title: 'Sollicitaties', desc: 'Meldingen over nieuwe en bijgewerkte sollicitaties.' },
    vacatures:     { title: 'Vacatures',     desc: 'Meldingen over vacature-updates en statuswijzigingen.' },
    facturering:   { title: 'Facturering',   desc: 'Meldingen over facturen, betalingen en abonnementen.' },
  }
  const { title, desc } = LABELS[context] ?? { title: context, desc: '' }
  const [prefs,   setPrefs]   = useState({ email: true, in_app: true })
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    loadSettings().then(s => {
      const e = s[`notif_${context}_email`]; const i = s[`notif_${context}_in_app`]
      if (e !== undefined) setPrefs(p => ({ ...p, email: e === 'true' || e === true }))
      if (i !== undefined) setPrefs(p => ({ ...p, in_app: i === 'true' || i === true }))
    }).catch(() => {})
  }, [context])

  const save = async () => {
    setSaving(true)
    try {
      await saveSettings({ [`notif_${context}_email`]: String(prefs.email), [`notif_${context}_in_app`]: String(prefs.in_app) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{desc}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? '#16A34A' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> Opgeslagen</> : <><Save size={13}/> Opslaan</>}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { key: 'email', label: 'E-mail notificaties', desc: 'Ontvang meldingen via e-mail' },
          { key: 'in_app', label: 'In-app notificaties', desc: 'Ontvang meldingen binnen het platform' },
        ].map(opt => (
          <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{opt.desc}</div>
            </div>
            <PermissionToggle checked={prefs[opt.key]} onChange={() => setPrefs(p => ({ ...p, [opt.key]: !p[opt.key] }))} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Facturering placeholders ─────────────────────────────────────────────────

function PlanbeheerSettings()          { return <PlaceholderSettings title="Planbeheer"              description="Beheer je abonnement en plan." /> }
function BetaalmethodenSettings()      { return <PlaceholderSettings title="Betaalmethoden"          description="Voeg betaalmethoden toe en beheer ze." /> }
function AutoOpwaarderenSettings()     { return <PlaceholderSettings title="Automatisch opwaarderen" description="Stel automatisch opwaarderen in." /> }
function GebruikSettings()             { return <PlaceholderSettings title="Gebruik"                 description="Bekijk je verbruiksoverzicht." /> }
function FacturenSettings()            { return <PlaceholderSettings title="Facturen"                description="Bekijk en download je facturen." /> }
function GebruikersbeheerSettings()    { return <UsersPage /> }

const NAV_GROUPS = [
  {
    label: 'Algemeen',
    items: [
      { id: 'kpis',       label: "KPI's",        icon: Target          },
      { id: 'display',    label: 'Weergave',     icon: LayoutDashboard },
      { id: 'branding',   label: 'Huisstijl',    icon: Palette         },
      { id: 'security',   label: 'Beveiliging',  icon: Lock            },
    ],
  },
  {
    label: 'Bedrijf',
    items: [
      { id: 'company',    label: 'Algemeen',     icon: Building2       },
      { id: 'locations',  label: 'Locaties',     icon: MapPin          },
    ],
  },
  {
    label: 'Personalisatie',
    items: [
      { id: 'memory',          label: 'Geheugen',        icon: BookOpen    },
      { id: 'phases',          label: 'Fasen',           icon: Layers      },
      { id: 'candidate_status',label: 'Kandidaatstatus', icon: UserCheck   },
      { id: 'vacancy',         label: 'Vacature',        icon: Briefcase   },
      { id: 'rejection',       label: 'Afwijsredenen',   icon: XCircle     },
    ],
  },
  {
    label: 'Notificaties',
    items: [
      { id: 'notif_sollicitaties', label: 'Sollicitaties', icon: Bell },
      { id: 'notif_vacatures',     label: 'Vacatures',     icon: Bell },
      { id: 'notif_facturering',   label: 'Facturering',   icon: Bell },
    ],
  },
  {
    label: 'Communicatie',
    items: [
      { id: 'email',     label: 'E-mail',   icon: Mail          },
      { id: 'whatsapp',  label: 'WhatsApp', icon: MessageCircle, requiresPage: 'whatsapp' },
    ],
  },
  {
    label: 'Integraties en API',
    items: [
      { id: 'appstore',  label: 'App store',  icon: Store      },
      { id: 'apikeys',   label: 'API-keys',   icon: Key        },
      { id: 'webhooks',  label: 'Webhooks',   icon: Webhook    },
      { id: 'importeren',label: 'Importeren', icon: Download   },
    ],
  },
  {
    label: 'Beheer',
    items: [
      { id: 'modules', label: 'Modules',           icon: Package,      superAdminOnly: true },
      { id: 'apps',    label: 'Apps (connectors)', icon: AppWindow,    superAdminOnly: true },
      { id: 'roles',   label: 'Rollen & Rechten',  icon: Shield        },
      { id: 'users',   label: 'Gebruikersbeheer',  icon: Users         },
      { id: 'sync',    label: 'Synchronisatie',     icon: RotateCcw     },
      { id: 'audit',   label: 'Audit log',          icon: ClipboardList },
    ],
  },
]

const ALL_TABS = NAV_GROUPS.flatMap(g => g.items)

export default function SettingsPage() {
  const auth = useAuth()
  const { isSuperAdmin } = auth

  // Filter tabs:
  //  - `superAdminOnly` tabs (Modules) are hidden for everyone except super admins
  //  - `users` tab is a gated page (accessible_pages)
  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(it => {
        if (it.superAdminOnly && !isSuperAdmin()) return false
        if (it.requiresPage && !canAccessPage(it.requiresPage, auth)) return false
        if (it.id === 'users' && !canAccessPage('users', auth)) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)
  const visibleTabs = visibleGroups.flatMap(g => g.items)

  const [tab, setTab] = useState(() => visibleTabs[0]?.id ?? null)

  // If the active tab is not (or no longer) visible for this role, fall back to the first one.
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === tab)) setTab(visibleTabs[0]?.id ?? null)
  }, [visibleTabs.map(t => t.id).join(','), tab])

  const current = visibleTabs.find(t => t.id === tab)

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* Left nav — only the groups/sections this role may see */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6',
        background: 'white', overflowY: 'auto', padding: '20px 10px',
      }}>
        <div style={{ paddingLeft: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Instellingen</div>
        </div>

        {visibleGroups.map(group => (
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
        {/* Empty state when the role has no visible sections at all */}
        {!current && (
          <div className="flex items-center justify-center" style={{ height: '60%' }}>
            <p className="text-sm text-gray-400">Geen instellingen beschikbaar voor jouw rol.</p>
          </div>
        )}

        {tab === 'kpis'       && <KpiSettings />}
        {tab === 'display'    && <DisplaySettings />}
        {tab === 'branding'   && <BrandingSettings />}
        {tab === 'security'   && <SecuritySettings />}
        {tab === 'company'    && <BedrijfAlgemeenSettings />}
        {tab === 'locations'  && <LocatiesSettings />}
        {tab === 'memory'     && <GeheugenSettings />}
        {tab === 'phases'     && <FasenSettings />}
        {tab === 'candidate_status' && <KandidaatstatusSettings />}
        {tab === 'vacancy'    && <VacatureSettings />}
        {tab === 'rejection'  && <AfwijsredenenSettings />}
        {tab === 'notif_sollicitaties' && <NotificatiesSettings context="sollicitaties" />}
        {tab === 'notif_vacatures'     && <NotificatiesSettings context="vacatures" />}
        {tab === 'notif_facturering'   && <NotificatiesSettings context="facturering" />}
        {tab === 'email'      && <EmailSettings />}
        {tab === 'whatsapp'   && <WhatsAppSettings />}
        {tab === 'appstore'   && <AppStoreSettings />}
        {tab === 'apikeys'    && <ApiKeysSettings />}
        {tab === 'webhooks'   && <WebhooksSettings />}
        {tab === 'importeren' && <ImporterenSettings />}
        {tab === 'billing_plans'    && <PlanbeheerSettings />}
        {tab === 'billing_pay'      && <BetaalmethodenSettings />}
        {tab === 'billing_auto'     && <AutoOpwaarderenSettings />}
        {tab === 'billing_usage'    && <GebruikSettings />}
        {tab === 'billing_invoices' && <FacturenSettings />}
        {tab === 'modules'  && <ModulesSettings />}
        {tab === 'apps'     && <AppsSettings />}
        {tab === 'roles'    && <RolesSettings />}
        {tab === 'users'    && <UsersPage />}
        {tab === 'sync'     && <SyncSettings />}
        {tab === 'audit'    && <AuditLog />}
      </div>
    </div>
  )
}
