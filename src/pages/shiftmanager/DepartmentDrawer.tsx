/**
 * DepartmentDrawer — slide-in detail panel for one department: hero (name +
 * status), the linked customer and location cards, two stat cards (employees /
 * shifts) and a notes placeholder. Pure presentation; the department is passed
 * in from DepartmentsPage.
 */
import { useTranslation } from 'react-i18next'
import { Layers, MapPin, Users, X, ChevronRight } from 'lucide-react'
import { ac, Avatar, StatusBadge } from './departmentParts'
import type { SmDepartmentRow } from '../../types/shiftmanager'

export default function DepartmentDrawer({ dep, onClose }: { dep: SmDepartmentRow | null; onClose: () => void }) {
  const { t } = useTranslation('shiftmanager')
  if (!dep) return null

  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('departmentsPage.drawerTitle')}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <Avatar label={dep.name} size={52} radius={10} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{dep.name}</div>
            <StatusBadge status={dep.status} />
          </div>
        </div>

        {/* Klant */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>{t('departmentsPage.customer')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: ac(dep.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
              {dep.customer?.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{dep.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('departmentsPage.linkedCustomer')}</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        {/* Locatie */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>{t('departmentsPage.location')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={16} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{dep.location}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dep.city}</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        {/* Cost center (from /sm_departments) */}
        {dep.costCenter && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--hover-bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
              textTransform: 'uppercase' }}>{t('departmentsPage.costCenter')}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{dep.costCenter}</span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: t('departmentsPage.employees'), value: dep.employees, Icon: Users,  color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
            { label: t('departmentsPage.shifts'),    value: dep.shifts,    Icon: Layers, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.Icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Notities leeg */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{t('departmentsPage.notes')}</div>
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
            background: 'var(--hover-bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            {t('departmentsPage.noNotes')}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button style={{ width: '100%', padding: 9, fontSize: 13, fontWeight: 500,
          borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
          color: 'var(--color-primary)', cursor: 'pointer' }}>
          {t('departmentsPage.edit')}
        </button>
      </div>
    </div>
  )
}
