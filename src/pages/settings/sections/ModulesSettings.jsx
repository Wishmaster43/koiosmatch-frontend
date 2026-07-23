/**
 * ModulesSettings — super-admin, per-tenant configuration (Super Admin tab).
 * Picks the base package (Core / Pro / Enterprise) + toggles add-ons (reporting /
 * AI planner / planning). Writes { package, addons } to PUT /tenant-modules.
 * Connectors live under Integrations → Apps. Super-admin-only; the backend re-checks.
 *
 * Model: besloten 2026-06-23 (memory `project-pricing-model`). Legacy package strings
 * are normalised to the new tier for display until the backend sends {package, addons}.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save, Package, Rocket, Crown, BarChart2, CalendarDays } from 'lucide-react'
// Real brand logos for the reporting add-ons (local assets, §7 CSP).
import shiftmanagerLogo from '@/assets/integrations/shiftmanager.png'
import helloflexLogo from '@/assets/integrations/helloflex.png'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { BTN_H } from '@/config/buttonMetrics'

// Base tiers (the "size bar"). `desc` lists what each tier adds over the previous one.
const TIERS = [
  { id: 'core',       name: 'Koios Core',       desc: 'ATS + CRM',                                              Icon: Package },
  { id: 'pro',        name: 'Koios Pro',        desc: '+ Koios AI + AI Agents + Workflows + WhatsApp Business', Icon: Rocket },
  { id: 'enterprise', name: 'Koios Enterprise', desc: '+ REST API + Insights+ + Connectors + SLA',              Icon: Crown },
]

// Add-ons (toggle on top of any tier). Each id maps 1:1 to a module key the backend
// must surface in tenant.modules (/auth/me) so the UI gate (lib/access.ts) can hide/show it.
// 'sm_ai' (Shiftmanager AI Planner) is retired (Danny 2026-07-02): no distinct surface, so it
// is no longer offered here — legacy tenants keep working (it still resolves to shiftmanager).
// MODULES-ICONS-1 (Danny 23-07): every row carries an icon — the reporting add-ons
// show the REAL brand logo of the system they report on.
const ADDONS = [
  { id: 'reports', name: 'Rapporten Koios Match',  Icon: BarChart2 },
  { id: 'sm',    name: 'Rapportage Shiftmanager',  image: shiftmanagerLogo },
  { id: 'hf',    name: 'Rapportage HelloFlex',     image: helloflexLogo },
  { id: 'plan',  name: 'Planning',                 Icon: CalendarDays },
]

// Legacy package string → new base tier (display only; the backend sends {package, addons}
// once migrated, and that wins). Keeps the UI sensible for not-yet-migrated tenants.
const LEGACY_TO_TIER = {
  core: 'core', pro: 'pro', enterprise: 'enterprise',
  ats_crm: 'core', ats_crm_planning: 'core',
  reporting_sm: 'core', reporting_hf: 'core', reporting_sm_hf: 'core',
  reporting_shiftmanager: 'core', reporting_helloflex: 'core',
  ats_crm_ai: 'pro', ats_crm_aiagents: 'pro', ats_crm_ai_planning: 'pro',
  reporting_sm_ai: 'pro', reporting_hf_ai: 'pro', reporting_sm_hf_ai: 'pro',
  ats_crm_workflows: 'enterprise', connect: 'enterprise',
}

const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

export default function ModulesSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant, refreshUser } = useAuth()
  const [pkg,     setPkg]     = useState('core')
  const [addons,  setAddons]  = useState([])
  const [savedAt, setSavedAt] = useState({ pkg: 'core', addons: [] }) // last-saved snapshot
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Load the tenant's current package + add-ons.
  useEffect(() => {
    if (!activeTenant?.id) return
    setLoading(true)
    api.get('/tenant-modules', { params: { tenant_id: activeTenant.id } })
      .then(res => {
        const tier = LEGACY_TO_TIER[res.data?.package] ?? 'core'
        const ad   = Array.isArray(res.data?.addons) ? res.data.addons : []
        setPkg(tier); setAddons(ad); setSavedAt({ pkg: tier, addons: ad })
      })
      .catch(() => { setPkg('core'); setAddons([]); setSavedAt({ pkg: 'core', addons: [] }) })
      .finally(() => setLoading(false))
  }, [activeTenant?.id])

  const hasChange = pkg !== savedAt.pkg || !sameSet(addons, savedAt.addons)

  // Re-sync on window focus so a long-open tab never shows stale toggles (a reseed or a
  // colleague's change elsewhere) — but never clobber the admin's unsaved edits.
  const stateRef = useRef({ pkg, addons, savedAt })
  useEffect(() => { stateRef.current = { pkg, addons, savedAt } }, [pkg, addons, savedAt])
  useEffect(() => {
    const onFocus = () => {
      if (!activeTenant?.id) return
      api.get('/tenant-modules', { params: { tenant_id: activeTenant.id } })
        .then(res => {
          const tier = LEGACY_TO_TIER[res.data?.package] ?? 'core'
          const ad   = Array.isArray(res.data?.addons) ? res.data.addons : []
          const { pkg: p, addons: a, savedAt: s } = stateRef.current
          const dirty = p !== s.pkg || !sameSet(a, s.addons)
          // Only adopt the fresh server truth when there is no pending local change.
          if (!dirty) { setPkg(tier); setAddons(ad) }
          setSavedAt({ pkg: tier, addons: ad })
        })
        .catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeTenant?.id])
  const toggleAddon = (id) => setAddons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // Persist { package, addons }. The backend re-checks authorization + validates.
  const save = async () => {
    setSaving(true)
    try {
      await api.put('/tenant-modules', { tenant_id: activeTenant?.id, package: pkg, addons })
      setSavedAt({ pkg, addons })
      await refreshUser()
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2500)
    } catch { /* noop */ }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('modules.loading')}</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Base package (one of three) */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.07em', marginBottom: 10 }}>
        {t('modules.tierHeading', { defaultValue: 'Pakket' })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {TIERS.map(tier => {
          const active = pkg === tier.id
          return (
            <div key={tier.id} onClick={() => setPkg(tier.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', cursor: 'pointer',
                borderRadius: 10, transition: 'border-color 0.12s, background 0.12s',
                background: active ? 'var(--color-primary-bg)' : 'var(--surface)',
                border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--border)'}` }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                background: active ? 'var(--color-primary)' : 'transparent' }}>
                {active && <Check size={11} color="#fff" />}
              </div>
              <tier.Icon size={17} color={active ? 'var(--color-primary)' : 'var(--text-muted)'} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{tier.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t(`modules.tierDesc.${tier.id}`, { defaultValue: tier.desc })}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add-ons (toggle on top of the package) */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.07em', marginBottom: 10 }}>
        {t('modules.addonsHeading', { defaultValue: 'Losse modules (add-ons)' })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {ADDONS.map(addon => {
          const on = addons.includes(addon.id)
          const disabled = addon.comingSoon
          return (
            <div key={addon.id}
              onClick={disabled ? undefined : () => toggleAddon(addon.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
                background: on ? 'var(--color-success-bg)' : 'var(--surface)',
                border: `1px solid ${on ? 'var(--color-success)' : 'var(--border)'}` }}>
              {/* Switch */}
              <div style={{ width: 34, height: 20, borderRadius: 999, flexShrink: 0, position: 'relative',
                background: on ? 'var(--color-success)' : 'var(--border)', transition: 'background 0.15s' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute',
                  top: 2, left: on ? 16 : 2, transition: 'left 0.15s' }} />
              </div>
              {addon.image
                ? <img src={addon.image} alt="" width={18} height={18} style={{ flexShrink: 0, objectFit: 'contain', borderRadius: 4 }} />
                : <addon.Icon size={16} color={on ? 'var(--color-success)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t(`modules.addon.${addon.id}`, { defaultValue: addon.name })}</span>
              {disabled && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-info)',
                  background: 'var(--color-info-bg)', borderRadius: 999, padding: '2px 8px' }}>
                  {t('modules.comingSoon', { defaultValue: 'binnenkort' })}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Save — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <button onClick={save} disabled={saving || !hasChange}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 20px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
                   background: savedOk ? 'var(--color-success)' : hasChange ? 'var(--color-primary)' : 'var(--border)',
                   color: 'white', cursor: (saving || !hasChange) ? 'not-allowed' : 'pointer',
                   transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}>
          {savedOk ? <><Check size={13} /> {t('modules.savedActive')}</>
          : saving  ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</>
          :           <><Save size={13} /> {t('modules.activate')}</>}
        </button>
      </div>
    </div>
  )
}
