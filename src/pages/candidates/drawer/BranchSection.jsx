import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../../lib/api'
import SearchSelect from '../../../components/ui/SearchSelect'
import { sectionBlock } from './constants'

/** Branch section — links the candidate to one or more customer branches. */
export default function BranchSection({ c }) {
  const { t } = useTranslation('candidates')
  const [branches, setBranches] = useState(c.branches ?? [])
  const [allLocations, setAllLocations] = useState([])

  useEffect(() => {
    api.get('/customers').then(r => {
      const d = r.data; setAllLocations(Array.isArray(d) ? d : (d?.data ?? []))
    }).catch(() => {})
  }, [])

  // Toggle a branch name in the candidate's branch list.
  const toggle = (name) => setBranches(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])
  const options = allLocations.map(l => { const name = l.name ?? l.company_name ?? l.id; return { value: name, label: name } })

  return (
    <div style={sectionBlock}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('sections.branch')}</div>
      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {branches.map(v => (
            <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
              borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
              {v}
              <button onClick={() => toggle(v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
            </span>
          ))}
        </div>
      )}
      {/* Shared searchable multi-select — replaces the old inline dropdown (DUP-1). */}
      <SearchSelect triggerLabel={t('sections.branchLink')} options={options} selected={branches} onToggle={toggle} />
    </div>
  )
}
