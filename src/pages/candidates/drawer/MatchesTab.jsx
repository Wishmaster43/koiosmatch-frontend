import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import AddableSection from '../../../components/forms/AddableSection'

// Form draft → API body (snake_case). Confirm column names with the backend:
// client, function_title, scale, step, hourly_rate, hours_per_week,
// start_date, end_date, contract_type, contract_duration.
const toApi = (v) => ({
  client: v.client, function_title: v.function, scale: v.scale, step: v.step,
  hourly_rate: v.hourlyRate, hours_per_week: v.hoursPerWeek,
  start_date: v.startDate, end_date: v.endDate,
  contract_type: v.contractType, contract_duration: v.contractDuration,
})

/** Matches list — optimistic local state that persists to
 * POST/PATCH/DELETE /candidates/{id}/matches. Fails soft (UI never breaks). */
export default function MatchesTab({ c }) {
  const { t } = useTranslation('candidates')
  const [matches, setMatches] = useState(c.matches ?? [])

  // add / edit-at-index / remove-at-index with optimistic persistence (negative temp id).
  const onAdd = (v) => {
    const id = -Date.now()
    setMatches(p => [...p, { ...v, id }])
    api.post(`/candidates/${c.id}/matches`, toApi(v))
      .then(r => { const it = r?.data?.data ?? r?.data; if (it?.id) setMatches(p => p.map(x => x.id === id ? { ...v, ...it } : x)) })
      .catch(() => {})
  }
  const onEdit = (i, v) => {
    const id = matches[i]?.id
    setMatches(p => p.map((x, idx) => idx === i ? { ...x, ...v } : x))
    if (id > 0) api.patch(`/candidates/${c.id}/matches/${id}`, toApi(v)).catch(() => {})
  }
  const onRemove = (i) => {
    const id = matches[i]?.id
    setMatches(p => p.filter((_, idx) => idx !== i))
    if (id > 0) api.delete(`/candidates/${c.id}/matches/${id}`).catch(() => {})
  }

  const fields = [
    { key: 'client',         label: t('work.client') },
    { key: 'function',       label: t('work.function') },
    { key: 'scale',        label: t('work.scale'), half: true },
    { key: 'step',         label: t('work.step'),  half: true },
    { key: 'hourlyRate',       label: t('work.hourlyRate'), half: true },
    { key: 'hoursPerWeek', label: t('work.hoursShort'), half: true },
    { key: 'startDate',   label: t('work.startDate'), separator: true, date: true },
    { key: 'endDate',   label: t('work.endDate'), date: true },
    { key: 'contractType', label: t('work.contractType'), half: true },
    { key: 'contractDuration',  label: t('work.contractDuration'), half: true },
  ]
  return (
    <AddableSection title={t('sections.placements')} emptyText={t('sections.placementsEmpty')}
      items={matches} fields={fields}
      onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(p, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.client || '-'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {p.startDate && p.endDate ? `${p.startDate} ${t('common:to')} ${p.endDate}` : (p.startDate ?? '')}
            </span>
          </div>
          {[
            [t('work.function'),         p.function || '-'],
            [t('work.scaleStep'),        p.scale && p.step ? `${p.scale} / ${p.step}` : (p.scale || p.step || '-')],
            [t('work.rate'),             p.hourlyRate ? `€ ${p.hourlyRate}` : '-'],
            [t('work.hoursPerWeek'),     p.hoursPerWeek || '-'],
            [t('work.contractType'),     p.contractType || '-'],
            [t('work.contractDuration'), p.contractDuration  || '-'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
      )} />
  )
}
