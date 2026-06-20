import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, FolderPlus, FolderMinus, X } from 'lucide-react'
import api from '../../lib/api'
import ActionMenu from '../../components/ui/ActionMenu'

/**
 * CandidatesBulkBar — the selection action bar shown above the table when ≥1
 * candidate is checked. Replaces the "add candidate" toolbar so the two never
 * clash. A single "Massa mutaties" menu (ActionMenu, drill-in) holds every bulk
 * mutation; new actions (status, owner, delete) slot in as extra menu items.
 */
export default function CandidatesBulkBar({ count, onClear, onAddToPool, onRemoveFromPool }) {
  const { t } = useTranslation('candidates')
  const [pools, setPools] = useState([])

  // Load the talent pools once for the add/remove option lists.
  useEffect(() => {
    api.get('/pools').then(r => { const d = r.data; setPools(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
  }, [])

  // Map pools → menu options (coloured dot per pool).
  const poolOptions = pools.map(p => ({ value: p.id ?? p.name, label: p.name, color: p.color || '#6B7280' }))

  // Resolve the picked id back to the full pool object, so the parent can patch
  // the table's pool column optimistically (needs name + colour, not just id).
  const pickPool = (handler) => (poolId) => {
    const pool = pools.find(p => (p.id ?? p.name) === poolId)
    if (pool) handler(pool)
  }

  // Declarative bulk-action tree; extend with status/owner/delete later.
  const items = [
    { key: 'add-pool', label: t('bulk.addToPool'), icon: FolderPlus,
      searchPlaceholder: t('bulk.searchPool'), emptyText: t('bulk.noPools'), options: poolOptions, onPick: pickPool(onAddToPool) },
    { key: 'remove-pool', label: t('bulk.removeFromPool'), icon: FolderMinus,
      searchPlaceholder: t('bulk.searchPool'), emptyText: t('bulk.noPools'), options: poolOptions, onPick: pickPool(onRemoveFromPool) },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
        {t('bulk.selected', { count })}
      </span>

      {/* Single bulk-mutations menu with drill-in submenus */}
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: '6px 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
