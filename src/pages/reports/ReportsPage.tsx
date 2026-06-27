/**
 * ReportsPage — the analytical reports hub (B-28). A thin shell that owns the
 * sub-tab bar (Flow · Recruiters · later Vacancies) and renders the active report.
 * Each report owns its own data layer + filters; this only switches tabs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FlowReport from './FlowReport'

// Placeholder for report tabs that are not built yet.
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 bg-[var(--surface)] rounded-xl"
      style={{ border: '1px solid var(--border)' }}>
      <p className="font-mono text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

export default function ReportsPage({ initialTab = 'flow' }: { initialTab?: string }) {
  const { t } = useTranslation('analytics')
  const [tab, setTab] = useState(initialTab)

  // Sub-tabs are config: { id, label }. Add a tab here when its report lands.
  const tabs = [
    { id: 'flow',       label: t('tabs.flow') },
    { id: 'recruiters', label: t('tabs.recruiters') },
  ]

  return (
    <div className="p-6">
      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('title')}</h1>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: tab === tb.id ? 600 : 400,
              color: tab === tb.id ? 'var(--color-primary)' : 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === tb.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'flow'
        ? <FlowReport />
        : <ComingSoon label={t('comingSoon', { label: t('tabs.recruiters') })} />}
    </div>
  )
}
