/**
 * DrawerTitleRow — canonical drawer-header title block shared by the candidate,
 * customer and vacancy drawer headers: PageTitle + reference-number chip
 * (NUMMER-1) + detached-count badge (ONTKOPPEL-TELLER-1), with a per-entity
 * subtitle line below (DRY round 10, DRAWERSHELLS). `titleAs` and `subtitle`
 * carry the one real difference between consumers (§3A "same spot").
 */
import type { ElementType, ReactNode } from 'react'
import { PageTitle } from '@/components/ui/typography'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import DetachedCountBadge from '@/components/ui/DetachedCountBadge'

interface DrawerTitleRowProps {
  title: ReactNode
  // Semantic element for PageTitle (candidate/vacancy use 'span', customer uses 'div').
  titleAs?: ElementType
  referenceNumber?: string | null
  detachedCount?: number
  subtitle: ReactNode
}

// Title + reference chip + detached badge + a subtitle line, identical across every drill-down header.
export default function DrawerTitleRow({ title, titleAs = 'span', referenceNumber, detachedCount, subtitle }: DrawerTitleRowProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <PageTitle as={titleAs} style={{ fontWeight: 700 }}>{title}</PageTitle>
        {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
        <ReferenceNumberChip value={referenceNumber} />
        {/* ONTKOPPEL-TELLER-1: whole-history CURRENTLY-detached count, warning-only (hidden at 0). */}
        <DetachedCountBadge count={detachedCount} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
    </>
  )
}
