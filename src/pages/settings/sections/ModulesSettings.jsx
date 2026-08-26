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
import SubTabBar from '@/components/drawer/SubTabBar'
import { useTranslation } from 'react-i18next'
import { Check, Save, Package, Rocket, Crown, BarChart2, CalendarDays } from 'lucide-react'
// Real brand logos for the reporting add-ons (local assets, §7 CSP).
import shiftmanagerLogo from '@/assets/integrations/shiftmanager.png'
import helloflexLogo from '@/assets/integrations/helloflex.png'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Spinner from '@/components/ui/Spinner'
import Toggle from '@/components/ui/Toggle'
import SaveButton from '@/components/ui/SaveButton'
import { GroupLabel } from '@/components/ui/typography'
import PlatformPricingCard from './PlatformPricingCard'
import BillingBudgetsCard from './BillingBudgetsCard'
import BillingUsersCard from './BillingUsersCard'

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
  { id: 'reports', name: 'Rapporten Koios Match',  Icon: BarChart2,          desc: 'Eigen Koios Match-rapportages en inzichten.' },
  { id: 'sm',    name: 'Rapportage Shiftmanager',  image: shiftmanagerLogo,  desc: 'Rapportages en GET-syncs op Shiftmanager-data (diensten, klanten, kandidaten).' },
  { id: 'hf',    name: 'Rapportage HelloFlex',     image: helloflexLogo,     desc: 'Rapportages en GET-syncs op HelloFlex-data.' },
  { id: 'plan',  name: 'Planning',                 Icon: CalendarDays,       desc: 'Eigen plannings­module: orders, diensten en inplanning.' },
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

// Super-admin tenant module config: base tier + add-ons, plus the platform pricing/budgets/users sub-tabs.
export default function ModulesSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant, refreshUser } = useAuth()
  const [pkg,     setPkg]     = useState('core')
  const [addons,  setAddons]  = useState([])
  const [savedAt, setSavedAt] = useState({ pkg: 'core', addons: [] }) // last-saved snapshot
  // MODULES-SUBTABS-1: which of the three groups is on screen.
  const [subTab, setSubTab] = useState('pricing')
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
  // Keep a ref mirror of the latest state so the focus handler below can read it without becoming its dependency.
  useEffect(() => { stateRef.current = { pkg, addons, savedAt } }, [pkg, addons, savedAt])
  // Add a window-focus listener so a long-open tab picks up a reseed or a colleague's change; removed on unmount.
  useEffect(() => {
    // Refetch server state and adopt it only when there's no unsaved local edit, per the dirty check below.
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
      {/* MODULES-SUBTABS-1 (Danny 24-08: "3 subtabjes aub") — the three stacked
          cards become sub-tabs in his named order; SubTabBar is the one shared
          switcher (roving tabindex, §6). */}
      <div style={{ marginBottom: 20 }}>
        <SubTabBar active={subTab} onChange={setSubTab} tabs={[
          { id: 'pricing', label: t('modules.tabs.pricing') },
          { id: 'budgets', label: t('modules.tabs.budgets') },
          { id: 'package', label: t('modules.tabs.package') },
          { id: 'users', label: t('modules.tabs.users') },
        ]} />
      </div>

      {/* Platform pricing (CREDITS-1) — the AI markup % and the workflow credit
          price knobs; superadmin-only. */}
      {subTab === 'pricing' && <PlatformPricingCard />}

      {/* CREDITS-2-FE deel 2 — package + per-tenant monthly budgets (Danny: "vul beiden en toon ze hier"). */}
      {subTab === 'budgets' && <BillingBudgetsCard />}

      {/* MODULES-USERS-SUBTAB-1 (K-167/K-175) — per-package included users + extra
          user price, plus the live per-tenant seat table. */}
      {subTab === 'users' && <BillingUsersCard />}

      {subTab === 'package' && (<>
      {/* Base package (one of three) */}
      <GroupLabel style={{ marginBottom: 10 }}>
        {t('modules.tierHeading')}
      </GroupLabel>
      {/* Shared SegmentedControl (audit finding, §4/§11) replaces the hand-rolled radio
          cards + hardcoded white check — same tier semantics/payload (setPkg(tier.id)),
          same success-green tint the "activate" flow already uses for "this is on". */}
      <div style={{ marginBottom: 28 }}>
        <SegmentedControl
          ariaLabel={t('modules.tierHeading')}
          color="var(--color-success)"
          // Only the chosen package is green, in exactly the add-on rows' green
          // (Danny 11-08). `color` drives the text + full border; activeFill is the
          // flat token those rows use, which no color-mix reproduces.
          activeOnly
          activeFill="var(--color-success-bg)"
          value={pkg}
          onChange={setPkg}
          options={TIERS.map(tier => ({
            value: tier.id,
            label: tier.name,
            description: t(`modules.tierDesc.${tier.id}`, { defaultValue: tier.desc }),
            icon: tier.Icon,
          }))}
        />
      </div>

      {/* Add-ons (toggle on top of the package) */}
      <GroupLabel style={{ marginBottom: 10 }}>
        {t('modules.addonsHeading')}
      </GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {ADDONS.map(addon => {
          const on = addons.includes(addon.id)
          const disabled = addon.comingSoon
          return (
            <div key={addon.id}
              onClick={disabled ? undefined : () => toggleAddon(addon.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
                // ONE green for both lists (Danny 11-08, exact values): the
                // --color-success-bg fill with the full --color-success border. That
                // pastel is NOT a mix of the green — measured, the closest mix (14%)
                // is visibly off — so it can only come from the token itself, which
                // is why the package picker below reads the SAME two tokens instead
                // of a color-mix approximation.
                background: on ? 'var(--color-success-bg)' : 'var(--surface)',
                border: `1px solid ${on ? 'var(--color-success)' : 'var(--border)'}` }}>
              {addon.image
                ? <img src={addon.image} alt="" width={18} height={18} style={{ flexShrink: 0, objectFit: 'contain', borderRadius: 4 }} />
                : <addon.Icon size={16} color={on ? 'var(--color-success)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t(`modules.addon.${addon.id}`, { defaultValue: addon.name })}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t(`modules.addonDesc.${addon.id}`, { defaultValue: addon.desc })}</div>
              </div>
              {/* Shared Toggle (audit finding, §4/§11) replaces the hand-rolled switch +
                  hardcoded white thumb — same on/off semantics (toggleAddon). Wrapped with
                  its own stopPropagation so clicking the switch directly does not ALSO fire
                  the row's own onClick (which would double-toggle it straight back off). */}
              <div onClick={(e) => e.stopPropagation()}>
                <Toggle checked={on} onChange={() => toggleAddon(addon.id)} disabled={disabled}
                  ariaLabel={t(`modules.addon.${addon.id}`, { defaultValue: addon.name })} />
              </div>
              {disabled && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-info)',
                  background: 'var(--color-info-bg)', borderRadius: 999, padding: '2px 8px' }}>
                  {t('modules.comingSoon')}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <SaveButton onClick={save} disabled={saving || !hasChange} saved={savedOk}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {savedOk ? <><Check size={13} /> {t('modules.savedActive')}</>
          : saving  ? <><Spinner size={13} /> {t('common.saving')}</>
          :           <><Save size={13} /> {t('modules.activate')}</>}
        </SaveButton>
      </div>
      </>)}
    </div>
  )
}
