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
import TenantUsageDetailsTable from './TenantUsageDetailsTable'
import TenantUsageBreakdownTable from './TenantUsageBreakdownTable'
import { Mono, GroupLabel, BodyText } from '@/components/ui/typography'
import StatTile from '@/components/ui/StatTile'
import { fieldSelectStyle } from '@/components/forms/fieldMetrics'

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('nl-NL'))

// Connector key → brand label (proper nouns, not translatable).
const CONNECTOR_LABELS = { sm: 'Shiftmanager', hf: 'HelloFlex', intus: 'Intus', elanza: 'Elanza', aelio: 'Aelio' }

// Build the last 12 months as { value: 'YYYY-MM', label } — newest first.
function buildMonths() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    return { value, label }
  })
}

// Small metric tile — the shared StatTile atom (klus c), usage face.
function Tile({ label, value }) {
  return <StatTile label={label} value={value} size="sm" labelFirst />
}

export default function TenantUsageSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant } = useAuth()
  const months = useMemo(() => buildMonths(), [])
  const [month, setMonth] = useState(months[0].value) // current month by default
  const [usage, setUsage] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | error

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

          {/* Metric tiles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
            <Tile label={t('usage.col.aiTokens')}   value={num(usage?.ai?.tokens)} />
            <Tile label={t('usage.col.aiCalls')}     value={num(usage?.ai?.requests)} />
            <Tile label={t('usage.col.waBusiness')} value={num(usage?.whatsapp?.business_numbers)} />
            <Tile label={t('usage.col.hours')}  value={num(usage?.planning?.processed_hours)} />
          </div>

          {/* Connectors (per connector — for invoicing) */}
          <GroupLabel style={{ marginBottom: 10 }}>
            {t('usage.col.connectors')}
          </GroupLabel>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {connectors.length === 0
              // Muted override: empty-state placeholder, secondary by design (§4 typografie).
              ? <BodyText as="div" style={{ padding: '11px 16px', color: 'var(--text-muted)' }}>—</BodyText>
              : connectors.map((c, i) => (
                <div key={c.key ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <BodyText as="span">{CONNECTOR_LABELS[c.key] ?? c.key}</BodyText>
                  <Mono style={{ fontSize: 13 }}>{num(c.usage)}</Mono>
                </div>
              ))}
          </div>

          {/* Per-month detail — the 12-month history the endpoint already returns,
              expandable per row into AI cost / workflow-per-module / connector
              breakdowns (§ usage details, 14-08). */}
          <GroupLabel style={{ marginTop: 24, marginBottom: 10 }}>
            {t('usage.details.title')}
          </GroupLabel>
          <TenantUsageDetailsTable history={usage?.history} />

          {/* Selected-month breakdown by activity/model/user/day — sums to the
              total above by server contract (CMBE, 14-08). */}
          <GroupLabel style={{ marginTop: 24, marginBottom: 10 }}>
            {t('usage.breakdown.title')}
          </GroupLabel>
          <TenantUsageBreakdownTable tenantId={activeTenant?.id} month={month} />
        </>
      )}
    </div>
  )
}
