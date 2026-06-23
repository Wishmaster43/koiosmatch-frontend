import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Check } from 'lucide-react'
import api from '../../../lib/api'
import { sectionBlock } from './constants'

/** Branch section — links the candidate to one or more customer branches. */
export default function BranchSection({ c }) {
  const { t } = useTranslation('candidates')
  const [branches, setBranches] = useState(c.branches ?? [])
  const [open, setOpen]               = useState(false)
  const [search, setSearch]           = useState('')
  const [allLocations, setAllLocations] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    api.get('/customers').then(r => {
      const d = r.data; setAllLocations(Array.isArray(d) ? d : (d?.data ?? []))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div style={sectionBlock}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('sections.branch')}</div>
      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {branches.map(v => (
            <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
              borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
              {v}
              <button onClick={() => setBranches(prev => prev.filter(x => x !== v))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 500,
            border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <Plus size={11} /> {t('sections.branchLink')}
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, width: 240,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common:search')} autoFocus
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {allLocations
                .filter(l => (l.name ?? l.company_name ?? '').toLowerCase().includes(search.toLowerCase()))
                .map(l => {
                  const name = l.name ?? l.company_name ?? l.id
                  const selected = branches.includes(name)
                  return (
                    <button key={l.id ?? name}
                      onClick={() => setBranches(prev => selected ? prev.filter(x => x !== name) : [...prev, name])}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '9px 12px', fontSize: 12, background: selected ? 'var(--color-primary-bg)' : 'none',
                        border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                      {name}
                      {selected && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                    </button>
                  )
                })
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
