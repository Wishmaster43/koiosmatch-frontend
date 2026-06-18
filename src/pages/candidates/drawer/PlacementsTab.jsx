import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddableSection from '../../../components/forms/AddableSection'

/** Placements list (add + read-only cards). */
export default function PlacementsTab({ c }) {
  const { t } = useTranslation('candidates')
  const [placements, setPlacements] = useState(c.placements ?? [])
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
      items={placements} fields={fields} onAdd={v => setPlacements(p => [...p, v])}
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
