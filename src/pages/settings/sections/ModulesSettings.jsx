/**
 * ModulesSettings — super-admin tab to set a tenant's package (tier). Each package
 * maps to a set of accessible_pages on the backend. Package labels come from i18n;
 * the feature matrix columns are product names kept as-is.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Package, RefreshCw, Save } from 'lucide-react'
import api from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'

// Package IDs must match what the backend accepts in PUT /tenant-modules { package }.
// Matrix model: 10 packages × 5 feature dimensions (col = feature, row = package).
const PACKAGES = [
  { id: 'reporting_sm',        nr: 1,  sm: true,  hf: false, ai: false, ats: false, plan: false },
  { id: 'reporting_hf',        nr: 2,  sm: false, hf: true,  ai: false, ats: false, plan: false },
  { id: 'reporting_sm_hf',     nr: 3,  sm: true,  hf: true,  ai: false, ats: false, plan: false },
  { id: 'reporting_sm_ai',     nr: 4,  sm: true,  hf: false, ai: true,  ats: false, plan: false },
  { id: 'reporting_hf_ai',     nr: 5,  sm: false, hf: true,  ai: true,  ats: false, plan: false },
  { id: 'reporting_sm_hf_ai',  nr: 6,  sm: true,  hf: true,  ai: true,  ats: false, plan: false },
  { id: 'ats_crm',             nr: 7,  sm: false, hf: false, ai: false, ats: true,  plan: false },
  { id: 'ats_crm_ai',          nr: 8,  sm: false, hf: false, ai: true,  ats: true,  plan: false },
  { id: 'ats_crm_planning',    nr: 9,  sm: false, hf: false, ai: false, ats: true,  plan: true  },
  { id: 'ats_crm_ai_planning', nr: 10, sm: false, hf: false, ai: true,  ats: true,  plan: true  },
]

// Feature columns — product/feature names, kept as-is.
const MATRIX_COLS = [
  { key: 'sm',   label: 'Shiftmanager',  icon: '📊', color: '#6B7280' },
  { key: 'hf',   label: 'HelloFlex',     icon: '🟡', color: '#0891B2' },
  { key: 'ai',   label: 'AI & Workflow', icon: '🤖', color: '#7C3AED' },
  { key: 'ats',  label: 'ATS & CRM',     icon: '📋', color: '#059669' },
  { key: 'plan', label: 'Planning',      icon: '📅', color: 'var(--color-info)' },
]

function MatrixCell({ active }) {
  return (
    <td style={{ textAlign: 'center', padding: '0 4px' }}>
      {active
        ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: '50%', background: 'var(--color-success-bg)' }}>
            <Check size={11} color="#059669" />
          </span>
        : <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 1, background: '#E5E7EB' }} />
      }
    </td>
  )
}

export default function ModulesSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant, refreshUser } = useAuth()
  const [currentPkgId, setCurrentPkgId] = useState(null)
  const [selectedId,   setSelectedId]   = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  const pkgLabel = (id) => t(`modules.packages.${id}`)

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
    } catch { /* noop */ }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
      <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('modules.loading')}</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Super admin notice */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                    background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, marginBottom: 24 }}>
        <Package size={15} color="#7C3AED" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#5B21B6' }}>{t('modules.superAdminTitle')}</div>
          <div style={{ fontSize: 12, color: '#7C3AED', marginTop: 2 }}>{t('modules.superAdminDesc')}</div>
        </div>
      </div>

      {/* Matrix table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-alt, #F9FAFB)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', width: '40%' }}>
                {t('modules.pkgCol')}
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
                    background: isSelected ? 'var(--color-secondary-bg)' : isActive ? '#F0FDF4' : 'white',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'var(--color-secondary-bg)' : isActive ? '#F0FDF4' : 'white' }}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 22 }}>{pkg.nr}</span>
                      <span style={{ fontSize: 13, fontWeight: isSelected || isActive ? 600 : 400,
                                      color: isSelected ? '#1D4ED8' : '#111827' }}>
                        {pkgLabel(pkg.id)}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#059669',
                                        background: 'var(--color-success-bg)', borderRadius: 999, padding: '1px 7px' }}>
                          {t('modules.current')}
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
                   background: saved ? 'var(--color-success)' : hasChange ? 'var(--color-primary)' : '#D1D5DB',
                   color: 'white', cursor: (saving || !hasChange) ? 'not-allowed' : 'pointer',
                   transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}>
          {saved  ? <><Check size={13} /> {t('modules.savedActive')}</>
          : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</>
          :          <><Save size={13} /> {t('modules.activate')}</>}
        </button>
        {hasChange && !saved && (
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {t('modules.changeFromTo', { from: pkgLabel(currentPkg.id), to: pkgLabel(selected.id) })}
          </span>
        )}
      </div>
    </div>
  )
}
