/**
 * SectionIconTitle — the muted-icon + SectionTitle header row shared by list
 * sections (workflow relations' Ouders/Kinderen, the workflow queue's
 * pending/waiting/scheduled/retrying blocks): an icon, the section title, and
 * an optional trailing slot (e.g. a row-count Caption). Layout only — callers
 * resolve their own title text via their own t() (§5). (DRY round 11, LAYOUT.)
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SectionTitle } from './typography'

export default function SectionIconTitle({ icon: Icon, title, children }: {
  icon: LucideIcon
  title: string
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Icon size={14} color="var(--text-muted)" />
      <SectionTitle as="span">{title}</SectionTitle>
      {children}
    </div>
  )
}
