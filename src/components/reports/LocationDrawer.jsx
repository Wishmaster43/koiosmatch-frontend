/**
 * LocationDrawer — slide-in panel with one location's details (address,
 * department, customer). Opened from LocationsTable. StatusBadge = active/inactive pill.
 */
import { X, Building2, MapPin, Layers, Hash } from 'lucide-react'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
      <Icon size={13} color="#D1D5DB" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: '#9CA3AF', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>
    </div>
  )
}

export default function LocationDrawer({ location, onClose }) {
  const departments = location.departments ?? []

  const addressParts = [
    location.street && location.house_number
      ? `${location.street} ${location.house_number}`
      : (location.street ?? null),
    location.postal_code,
    location.city,
    location.country,
  ].filter(Boolean)
  const fullAddress = addressParts.join(', ') || null

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <MapPin size={15} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{location.name}</span>
                <StatusBadge status={location.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={12} color="#9CA3AF" />
                <span style={{ fontSize: 12, color: '#6B7280' }}>{location.customer_name}</span>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Samenvatting */}
        <div style={{ display: 'flex', gap: 1, background: '#F9FAFB',
                      borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Layers size={12} color="#9CA3AF" />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{departments.length}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Afdelingen</div>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 8 }}>
            Locatiegegevens
          </div>

          <InfoRow icon={MapPin}    label="Adres"           value={fullAddress} />
          <InfoRow icon={Hash}      label="Extern ID"       value={location.external_id} />
          <InfoRow icon={Building2} label="Klant"           value={location.customer_name} />

          {departments.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 10 }}>
                Afdelingen ({departments.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {departments.map((d, i) => (
                  <div key={d.id ?? i}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                             background: '#F9FAFB', borderRadius: 8, padding: '9px 12px' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{d.name}</div>
                      {d.cost_center && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>
                          {d.cost_center}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
