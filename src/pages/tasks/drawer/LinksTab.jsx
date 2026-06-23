import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2, X, Plus } from 'lucide-react'
import api, { unwrapList } from '../../../lib/api'
import { SelectField } from '../../../components/forms/fields'
import SearchSelect from '../../../components/ui/SearchSelect'

// Link types you can add from the drawer + how to fetch/label their entities.
// (Other polymorphic types stay supported on existing links via the read row.)
const TYPE_ENDPOINTS = {
  candidate: { url: '/candidates', label: r => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || `#${r.id}` },
  customer:  { url: '/customers',  label: r => r.name || `#${r.id}` },
  contact:   { url: '/contacts',   label: r => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || `#${r.id}` },
  vacancy:   { url: '/vacancies',  label: r => r.title || r.name || `#${r.id}` },
}

// Inline "add link" row: pick a type, then pick an entity of that type (already
// linked entities are filtered out). Selecting an entity adds it and closes.
function AddLinkRow({ existing, onAdd, onClose }) {
  const { t } = useTranslation('tasks')
  const [type, setType] = useState('candidate')
  const [rows, setRows] = useState([])

  // Load the chosen type's entities once; a missing endpoint keeps the list empty.
  useEffect(() => {
    setRows([])
    const cfg = TYPE_ENDPOINTS[type]; if (!cfg) return
    let alive = true
    api.get(cfg.url).then(r => { if (alive) setRows(unwrapList(r).rows) }).catch(() => {})
    return () => { alive = false }
  }, [type])

  const cfg = TYPE_ENDPOINTS[type]
  const linked = new Set(existing.filter(l => l.type === type).map(l => String(l.id)))
  const options = rows.filter(r => !linked.has(String(r.id))).map(r => ({ value: String(r.id), label: cfg.label(r) }))
  const typeOptions = Object.keys(TYPE_ENDPOINTS).map(k => ({ value: k, label: t(`links.${k}`) }))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
      border: '1px dashed var(--border)', borderRadius: 10, marginBottom: 8 }}>
      <div style={{ width: 150, flexShrink: 0 }}>
        <SelectField value={type} onChange={setType} options={typeOptions} />
      </div>
      <SearchSelect triggerLabel={t('links.selectEntity')} options={options} selected={[]}
        onToggle={(v) => { const r = rows.find(x => String(x.id) === v); onAdd({ type, id: v, label: r ? cfg.label(r) : '' }); onClose() }} />
      <div style={{ flex: 1 }} />
      <button onClick={onClose} aria-label={t('modal.cancel')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
        <X size={15} />
      </button>
    </div>
  )
}

/**
 * LinksTab — the polymorphic entities a task is linked to. Lists the current links
 * with a remove (×) per row and an inline "add link" row. Mutations go through the
 * page (onAddLink / onRemoveLink → POST|DELETE /tasks/{id}/links), which re-syncs
 * from the returned task detail. The type label comes from i18n, never hardcoded.
 */
export default function LinksTab({ task, onAddLink, onRemoveLink }) {
  const { t } = useTranslation('tasks')
  const [adding, setAdding] = useState(false)
  const links = task.links ?? []
  const typeLabel = (type) => t(`links.${type}`, { defaultValue: type })

  return (
    <div>
      {/* Add control */}
      {adding ? (
        <AddLinkRow existing={links} onAdd={onAddLink} onClose={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, fontWeight: 500,
            border: '1px dashed var(--border)', borderRadius: 8, background: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', marginBottom: 12 }}>
          <Plus size={13} /> {t('links.add')}
        </button>
      )}

      {/* Existing links */}
      {links.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('links.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {links.map((l, i) => (
            <div key={`${l.type}-${l.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                <Link2 size={15} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  {typeLabel(l.type)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.label || '—'}
                </div>
              </div>
              <button onClick={() => onRemoveLink({ type: l.type, id: l.id })} title={t('links.remove')} aria-label={t('links.remove')}
                style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: '#FEF2F2', border: 'none', borderRadius: 6, color: 'var(--color-danger)', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
