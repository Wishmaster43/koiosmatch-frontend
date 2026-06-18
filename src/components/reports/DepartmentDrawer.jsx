/**
 * DepartmentDrawer — slide-in panel with one department's details (customer,
 * location, codes). Opened from DepartmentsTable. InfoRow = one labeled detail row.
 */
import { useTranslation } from 'react-i18next'
import { X, Building2, MapPin, Hash, Layers } from 'lucide-react'

// One labeled row of department info (hidden when value is empty).
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

export default function DepartmentDrawer({ department, onClose }) {
  const { t } = useTranslation('reports')
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 420, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Layers size={15} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{department.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={12} color="#9CA3AF" />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{department.customer_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} color="#9CA3AF" />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{department.location_name}</span>
                </div>
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

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 8 }}>
            {t('departmentDrawer.info')}
          </div>

          <InfoRow icon={Layers}    label={t('departmentDrawer.name')} value={department.name} />
          <InfoRow icon={Hash}      label={t('dr.costCenter')}         value={department.cost_center} />
          <InfoRow icon={Hash}      label={t('dr.externalId')}         value={department.external_id} />
          <InfoRow icon={MapPin}    label={t('dr.location')}           value={department.location_name} />
          <InfoRow icon={Building2} label={t('dr.customer')}           value={department.customer_name} />

          {department.remarks && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 8 }}>
                {t('dr.remarks')}
              </div>
              <div style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', borderRadius: 8,
                            padding: '10px 12px', lineHeight: 1.6 }}>
                {department.remarks}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
