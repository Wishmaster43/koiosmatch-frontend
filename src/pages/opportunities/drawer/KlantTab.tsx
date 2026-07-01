import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2 } from 'lucide-react'
import DetailTableJs from '@/components/ui/DetailTable'
import type { Opportunity } from '@/types/opportunity'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

// Titled card wrapper (consistent with the Details tab).
function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

/**
 * KlantTab — the customer this opportunity is linked to (klant → locatie → afdeling →
 * contactpersoon), read-only. The org axes are edited via the header/dependent pickers;
 * this tab is the "link" to the customer the deal belongs to.
 */
export default function KlantTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')

  const rows = [
    [t('details.client'),     o.client || '—'],
    [t('details.location'),   o.location || '—'],
    [t('details.department'), o.department || '—'],
    [t('details.contact'),    o.contact || '—'],
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text)' }}>
        <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{o.client || '—'}</span>
      </div>
      <Card title={t('drawer.tabs.klant')}><DetailTable rows={rows} lastBorder={false} /></Card>
    </div>
  )
}
