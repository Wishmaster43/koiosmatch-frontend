/**
 * UsageTotalsRow — the ONE totals strip under a usage table (§11 one source):
 * label left, Mono values right. Extracted after two tables shipped verbatim
 * hand-rolled twins of this chrome (Opus round, TENANT-USAGE-POLISH-1).
 */
import type { ReactNode } from 'react'
import { Mono } from '@/components/ui/typography'

export default function UsageTotalsRow({ label, values }: { label: string; values: ReactNode[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 6, padding: '8px 10px', fontSize: 12, fontWeight: 600,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <span>{label}</span>
      <Mono style={{ display: 'flex', gap: 16, fontWeight: 400 }}>
        {values.map((v, i) => <span key={i}>{v}</span>)}
      </Mono>
    </div>
  )
}
