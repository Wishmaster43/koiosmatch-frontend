/**
 * DepartmentDrawer — slide-in detail panel for one department: hero (name +
 * status), the linked customer and location cards, two stat cards (employees /
 * shifts) and a notes placeholder. Pure presentation; the department is passed
 * in from DepartmentsPage.
 */
import { useTranslation } from 'react-i18next'
import { Layers, MapPin, Users, ChevronRight } from 'lucide-react'
import { Caption, BodyText, GroupLabel, SectionTitle, monoStyle } from '@/components/ui/typography'
import SmDrawerShell from '@/components/shiftmanager/SmDrawerShell'
import SmStatCardGrid from '@/components/shiftmanager/SmStatCardGrid'
import { ac, Avatar, StatusBadge } from './departmentParts'
import type { SmDepartmentRow } from '@/types/shiftmanager'

// Read-only slide-in detail panel for one Shiftmanager department (mirror data,
// no write route — see the footer comment for why there is no edit action).
export default function DepartmentDrawer({ dep, onClose }: { dep: SmDepartmentRow | null; onClose: () => void }) {
  const { t } = useTranslation('shiftmanager')
  if (!dep) return null

  // No footer edit action (§3/§3B): /sm_departments is a read-only ShiftManager
  // mirror with no write route — the old "Edit" button never persisted anything.
  return (
    <SmDrawerShell title={t('departmentsPage.drawerTitle')} onClose={onClose}>

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
        <GroupLabel style={{ marginBottom: 10 }}>{t('departmentsPage.customer')}</GroupLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: ac(dep.customer),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
            {dep.customer?.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <BodyText style={{ fontWeight: 600 }}>{dep.customer}</BodyText>
            <Caption>{t('departmentsPage.linkedCustomer')}</Caption>
          </div>
          <ChevronRight size={14} color="var(--text-muted)" />
        </div>
      </div>

      {/* Locatie */}
      <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
        marginBottom: 20, border: '1px solid var(--border)' }}>
        <GroupLabel style={{ marginBottom: 10 }}>{t('departmentsPage.location')}</GroupLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={16} color="var(--color-primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <BodyText style={{ fontWeight: 600 }}>{dep.location}</BodyText>
            <Caption>{dep.city}</Caption>
          </div>
          <ChevronRight size={14} color="var(--text-muted)" />
        </div>
      </div>

      {/* Cost center (from /sm_departments) */}
      {dep.costCenter && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--hover-bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          border: '1px solid var(--border)' }}>
          <GroupLabel as="span">{t('departmentsPage.costCenter')}</GroupLabel>
          <SectionTitle as="span" style={{ fontFamily: monoStyle.fontFamily }}>{dep.costCenter}</SectionTitle>
        </div>
      )}

      {/* Stats */}
      <SmStatCardGrid
        cards={[
          { label: t('departmentsPage.employees'), value: dep.employees ?? 0, Icon: Users, color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)' },
          { label: t('departmentsPage.shifts'), value: dep.shifts ?? 0, Icon: Layers, color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
        ]}
      />

      {/* Notities leeg */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle style={{ marginBottom: 10 }}>{t('departmentsPage.notes')}</SectionTitle>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          background: 'var(--hover-bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
          {t('departmentsPage.noNotes')}
        </div>
      </div>
    </SmDrawerShell>
  )
}
