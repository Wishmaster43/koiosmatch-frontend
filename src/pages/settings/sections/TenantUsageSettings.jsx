/**
 * TenantUsageSettings — usage for the ACTIVE (selected) tenant ONLY. The super-admin
 * switches the tenant; this shows that one customer's usage for manual invoicing.
 * NEVER an all-tenants list. Quantities only — no prices, no PII.
 * Source: GET /admin/tenants/{id}/usage?month=YYYY-MM. Month selector = history.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import SearchSelect from '@/components/ui/SearchSelect'
import SubTabBar from '@/components/drawer/SubTabBar'
import TenantUsageKpiRow from './TenantUsageKpiRow'
import TenantUsageDetailsTable from './TenantUsageDetailsTable'
import TenantUsageBreakdownTable from './TenantUsageBreakdownTable'
import { Mono, GroupLabel, SectionTitle, BodyText } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import { card } from './usageCardStyles'
import { fieldSelectStyle } from '@/components/forms/fieldMetrics'
import AdminSubscriptionCard from './usage/AdminSubscriptionCard'
// App-wide active locale (DATUM-1/LANE-B) — feeds the month-picker labels.
import { useLocale } from '@/lib/datetime'

// Connector key → brand label (proper nouns, not translatable).
const CONNECTOR_LABELS = { sm: 'Shiftmanager', hf: 'HelloFlex', intus: 'Intus', elanza: 'Elanza', aelio: 'Aelio' }

// Build the last 12 months as { value: 'YYYY-MM', label } — newest first.
// `locale` is required (a pure module-scope helper never hardcodes nl-NL).
function buildMonths(locale) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    return { value, label }
  })
}

// Usage screen for the active tenant only (see the module doc above): the month selector browses history, never an all-tenants list.
export default function TenantUsageSettings() {
  const { t } = useTranslation('settings')
  const { formatNumber } = useNumberFormat()
  const { activeTenant } = useAuth()
  const locale = useLocale()
  // Rebuilt only when the app locale changes (§9: never a fresh array per render).
  const months = useMemo(() => buildMonths(locale), [locale])
  const [month, setMonth] = useState(months[0].value) // current month by default
  const [usage, setUsage] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | error
  // SA-USAGE-SUBTABS-1: which of the three groups is on screen. Shared state
  // (tenant/month) stays above the tabs, so switching tabs resets nothing.
  const [subTab, setSubTab] = useState('kpis')

  // Fetch the ACTIVE tenant's usage for the selected month — refetch on tenant or month change.
  useEffect(() => {
    if (!activeTenant?.id) { setPhase('error'); return }
    const ctrl = new AbortController()
    setPhase('loading')
    api.get(`/admin/tenants/${activeTenant.id}/usage`, { params: { month }, signal: ctrl.signal })
      .then(res => { setUsage(unwrap(res) ?? {}); setPhase('ready') })
      .catch(() => setPhase('error'))
    return () => ctrl.abort()
  }, [activeTenant?.id, month])

  const connectors = Array.isArray(usage?.connectors) ? usage.connectors : []
  // Honest read of an all-zero month: the tables below are correct but look
  // broken (a wall of zeros), so say out loud that nothing was consumed rather
  // than leaving the reader to work out whether the screen failed.
  const nothingUsed = phase === 'ready'
    && !usage?.ai?.tokens && !usage?.ai?.requests
    && !connectors.some(c => Number(c?.usage) > 0)

  return (
    // Deliberately wider than the 640px settings-form width: this section is a
    // DATA screen (three tables of five to six numeric columns), and at 640 the
    // columns crushed together with half the page left empty (Danny 17-08).
    <div style={{ maxWidth: 1080 }}>
      {/* Tenant + month selector — super-admin switches the tenant; the month picker is the history */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          {t('usage.subtitleTenant', {
            name: activeTenant?.name ?? '—',
            defaultValue: 'Verbruik van {{name}} — alleen hoeveelheden voor je facturatie.',
          })}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.month', { defaultValue: 'Maand' })}</span>
          <SearchSelect
            options={months.map(m => ({ value: m.value, label: m.label }))}
            selected={[month]}
            onToggle={setMonth}
            closeOnToggle
            renderTrigger={toggle => (
              // §4 2b: a dropdown TRIGGER is a FORM FIELD — its face comes from
              // fieldMetrics' select canon, never a hand-painted box.
              <button type="button" onClick={toggle}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- form-field trigger face (fieldSelectStyle canon), not an action button
                style={{ ...fieldSelectStyle, width: 'auto', textTransform: 'capitalize' }}>
                {months.find(m => m.value === month)?.label ?? month}
              </button>
            )}
          />
        </label>
      </div>

      {/* SA-USAGE-SUBTABS-1 (Danny 24-08): kpis / monthly / breakdown, same
          SubTabBar idiom as ModulesSettings (MODULES-SUBTABS-1). Tenant/month
          selection stays above the tabs, so switching tabs resets nothing. */}
      <div style={{ marginBottom: 20 }}>
        <SubTabBar active={subTab} onChange={setSubTab} tabs={[
          { id: 'kpis', label: t('usage.tabs.kpis') },
          { id: 'monthly', label: t('usage.tabs.monthly') },
          { id: 'breakdown', label: t('usage.tabs.breakdown') },
        ]} />
      </div>

      {subTab === 'kpis' && (<>
        {/* KPI strip renders through the load too — its own skeleton state keeps
            the layout stable instead of popping in after the fetch. */}
        {phase !== 'error' && <TenantUsageKpiRow usage={usage} loading={phase === 'loading'} />}
        {phase === 'loading' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('common.loadingShort', { defaultValue: 'Laden…' })}</p>}
        {phase === 'error'   && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('usage.loadError')}</p>}

        {phase === 'ready' && (
          <>
            {nothingUsed && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', padding: '9px 12px',
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                {t('usage.nothingUsed')}
              </p>
            )}

            {/* BILLING-FACTUUR-1: the subscription split (package · users · add-ons
                · total) straight from the usage payload; renders nothing on an
                older BE without the block. */}
            <AdminSubscriptionCard subscription={usage?.subscription} />

            {/* Connectors (per connector — for invoicing), a real card. */}
            <div style={card}>
              <SectionTitle style={{ marginBottom: 10 }}>{t('usage.col.connectors')}</SectionTitle>
              {connectors.length === 0
                // Muted override: empty-state placeholder, secondary by design (§4 typografie).
                ? <BodyText as="div" style={{ color: 'var(--text-muted)' }}>—</BodyText>
                : connectors.map((c, i) => (
                  <div key={c.key ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <BodyText as="span">{CONNECTOR_LABELS[c.key] ?? c.key}</BodyText>
                    <Mono style={{ fontSize: 13 }}>{formatNumber(c.usage)}</Mono>
                  </div>
                ))}
            </div>
          </>
        )}
      </>)}

      {subTab === 'monthly' && (
        // Per-month detail — the 12-month history the endpoint already returns,
        // expandable per row into AI cost / workflow-per-module / connector
        // breakdowns (§ usage details, 14-08). Same four-state handling as the
        // kpis tab: an error must never render as an innocent empty table (§3).
        <>
          {phase === 'loading' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('common.loadingShort', { defaultValue: 'Laden…' })}</p>}
          {phase === 'error'   && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('usage.loadError')}</p>}
          {phase === 'ready' && (
            <>
              <GroupLabel style={{ marginBottom: 10 }}>
                {t('usage.details.title')}
              </GroupLabel>
              <TenantUsageDetailsTable history={usage?.history} />
            </>
          )}
        </>
      )}

      {subTab === 'breakdown' && (
        // Selected-month breakdown by activity/model/user/day — sums to the
        // total above by server contract (CMBE, 14-08).
        <>
          <GroupLabel style={{ marginBottom: 10 }}>
            {t('usage.breakdown.title')}
          </GroupLabel>
          <TenantUsageBreakdownTable tenantId={activeTenant?.id} month={month} />
        </>
      )}
    </div>
  )
}
