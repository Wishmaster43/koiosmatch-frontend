/**
 * CustomerDetailDrawer — slide-in panel with one customer's details (locations,
 * departments, contacts). Opened from CustomersTable. StatusBadge = active/inactive pill.
 */
import { X, MapPin, Building2, Hash, User, Layers } from 'lucide-react'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
      <Icon size={12} color="#D1D5DB" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ color: '#9CA3AF', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#374151' }}>{value}</span>
    </div>
  )
}

export default function CustomerDetailDrawer({ customer, onClose }) {
  const locations = customer.locations ?? []
  const totalDepts = locations.reduce((s, l) => s + (l.departments?.length ?? 0), 0)

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 560, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{customer.name}</span>
              <StatusBadge status={customer.status} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <InfoRow icon={Hash}    label="Debiteur-nr"      value={customer.debtor_number} />
              <InfoRow icon={Hash}    label="Extern ID"        value={customer.external_id} />
              <InfoRow icon={User}    label="Accountmanager"   value={customer.account_manager} />
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                     borderRadius: 6, marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
        </div>

        {/* Samenvatting */}
        <div style={{ display: 'flex', gap: 1, background: '#F9FAFB',
                      borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          {[
            { label: 'Locaties',   value: locations.length,  icon: MapPin },
            { label: 'Afdelingen', value: totalDepts,         icon: Layers },
          ].map(b => (
            <div key={b.label} style={{ flex: 1, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <b.icon size={12} color="#9CA3AF" />
                <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{b.value}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{b.label}</div>
            </div>
          ))}
        </div>

        {/* Locaties lijst */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {locations.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 100, fontSize: 13, color: '#9CA3AF' }}>
              Geen locaties bekend
            </div>
          )}
          {locations.map((loc, i) => (
            <div key={loc.id ?? i}
              style={{ padding: '12px 18px', borderBottom: '1px solid #F9FAFB' }}>

              {/* Locatie header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                              background: '#EFF6FF', display: 'flex', alignItems: 'center',
                              justifyContent: 'center' }}>
                  <Building2 size={13} color="#2563EB" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{loc.name}</div>
                  {(loc.street || loc.city) && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                      {[loc.street, loc.house_number, loc.postal_code, loc.city]
                        .filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
                <StatusBadge status={loc.status} />
              </div>

              {/* Afdelingen */}
              {(loc.departments ?? []).length > 0 && (
                <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {loc.departments.map((dept, j) => (
                    <div key={dept.id ?? j}
                      style={{ display: 'flex', alignItems: 'center', gap: 6,
                               padding: '4px 8px', borderRadius: 6, background: '#F9FAFB' }}>
                      <Layers size={10} color="#9CA3AF" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{dept.name}</span>
                      {dept.cost_center && (
                        <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
                          {dept.cost_center}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 18px',
                      borderTop: '1px solid #F3F4F6', background: '#FAFAFA', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ fontSize: 12, borderRadius: 6, padding: '5px 14px',
                     background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280' }}>
            Sluiten
          </button>
        </div>
      </div>
    </>
  )
}
