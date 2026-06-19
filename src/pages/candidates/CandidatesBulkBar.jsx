import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, FolderPlus, X } from 'lucide-react'
import api from '../../lib/api'

/**
 * CandidatesBulkBar — the selection action bar shown above the table when ≥1
 * candidate is checked. Replaces the "add candidate" toolbar so the two never
 * clash. Currently: add the selection to a talent pool (dropdown from /pools);
 * built so status/owner/tag mutations can slot in as extra dropdowns later.
 */
export default function CandidatesBulkBar({ count, onClear, onPickPool }) {
  const { t } = useTranslation('candidates')
  const [open,  setOpen]  = useState(false)
  const [pools, setPools] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    api.get('/pools').then(r => { const d = r.data; setPools(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
        {t('bulk.selected', { count })}
      </span>

      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500,
            border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <FolderPlus size={13} /> {t('bulk.addToPool')} <ChevronDown size={13} />
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, width: 240,
            background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {pools.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('bulk.noPools')}</div>
              )}
              {pools.map(p => {
                const color = p.color || '#6B7280'
                return (
                  <button key={p.id ?? p.name} onClick={() => { setOpen(false); onPickPool(p.id ?? p.name) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', fontSize: 12,
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {p.name}
                    <Check size={12} style={{ marginLeft: 'auto', opacity: 0 }} />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: '6px 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
