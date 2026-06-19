import { useTranslation } from 'react-i18next'
import { MapPin, Building, Users, Plus } from 'lucide-react'
import EntityDrawer from '../../components/drawer/EntityDrawer'
import EntityHeader from '../../components/drawer/EntityHeader'

const STATUS_COLORS = { actief: '#16A34A', prospect: '#1B60A9', inactief: '#D97706', geblokkeerd: '#DC2626' }

const sectionCard = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 }

function EmptyState({ label }) {
  return <div style={{ padding: '24px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{label}</div>
}

/**
 * CustomerDrawer — clean customer detail with the sub-entities as tabs
 * (Locaties / Afdelingen / Contactpersonen), mirroring the candidate drawer.
 */
export default function CustomerDrawer({ customer: c, onClose, expanded, onToggleExpand, onAdd }) {
  const { t } = useTranslation('customers')
  if (!c) return null

  const locations = c.locations ?? []
  const departments = locations.flatMap(l => (l.departments ?? []).map(d => ({ ...d, location: l.name })))
  const contacts = c.contacts ?? []

  const TABS = [
    { id: 'locations',   icon: MapPin,   label: t('cols.locations'),   count: locations.length },
    { id: 'departments', icon: Building, label: t('cols.departments'), count: departments.length },
    { id: 'contacts',    icon: Users,    label: t('cols.contacts'),    count: contacts.length },
  ]

  const renderTab = (id) => {
    if (id === 'locations') return (
      <div style={sectionCard}>
        {locations.length === 0 ? <EmptyState label={t('drawer.noLocations')} /> : locations.map((l, i) => (
          <div key={l.id ?? i} style={{ ...rowStyle, borderBottom: i < locations.length - 1 ? rowStyle.borderBottom : 'none' }}>
            <MapPin size={14} color="var(--color-secondary)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text)' }}>{l.name ?? `${t('cols.locations')} ${i + 1}`}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(l.departments ?? []).length} {t('cols.departments').toLowerCase()}</span>
          </div>
        ))}
      </div>
    )
    if (id === 'departments') return (
      <div style={sectionCard}>
        {departments.length === 0 ? <EmptyState label={t('drawer.noDepartments')} /> : departments.map((d, i) => (
          <div key={d.id ?? i} style={{ ...rowStyle, borderBottom: i < departments.length - 1 ? rowStyle.borderBottom : 'none' }}>
            <Building size={14} color="#8B5CF6" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text)' }}>{d.name ?? `${t('cols.departments')} ${i + 1}`}</span>
            {d.location && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.location}</span>}
          </div>
        ))}
      </div>
    )
    return (
      <div style={sectionCard}>
        {contacts.length === 0 ? <EmptyState label={t('drawer.noContacts')} /> : contacts.map((p, i) => (
          <div key={p.id ?? i} style={{ ...rowStyle, borderBottom: i < contacts.length - 1 ? rowStyle.borderBottom : 'none' }}>
            <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text)' }}>{p.name ?? `${t('cols.contacts')} ${i + 1}`}</div>
              {(p.role || p.email) && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[p.role, p.email].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <EntityDrawer
      entity={c}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.debtorNumber ? `${t('cols.debtorNumber')} ${c.debtorNumber}` : ''}</span>}
      tabs={TABS.map(tab => ({
        id: tab.id,
        label: `${tab.label} (${tab.count})`,
        render: () => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => onAdd?.(tab.id, c)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 12, fontWeight: 500,
                  background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                <Plus size={12} /> {tab.label}
              </button>
            </div>
            {renderTab(tab.id)}
          </div>
        ),
      }))}
      header={() => (
        <EntityHeader
          label={t('title')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials }}
          renderTitle={() => (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.city || '—'}</div>
            </>
          )}
          meta={[
            { key: 'status', label: t('cols.status'), value: c.status,
              options: Object.keys(STATUS_COLORS).map(s => ({ value: s, label: t(`status.${s}`) })), onChange: () => {}, menuWidth: 160 },
            { key: 'am', label: t('cols.accountManager'), value: c.accountManager || '—',
              options: [{ value: c.accountManager || '—', label: c.accountManager || '—' }], onChange: () => {}, menuWidth: 200 },
          ]}
        />
      )}
    />
  )
}
