/**
 * ModalityChip — the shared C.14 axis chip: office/remote/phone, icon + soft-tint
 * (§4 chip convention), one look on every appointment card/list. Rank order (C.14,
 * Danny 31-08 "ik volg je advies"): on-location, then video, then phone — callers
 * that need the order for a legend/filter iterate `MODALITY_ICON` keys directly,
 * there is no separate exported constant (a prior one had zero consumers, §11).
 */
import { Building2, Video, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SoftChip from './SoftChip'
import type { Modality } from '@/lib/useAppointmentTypes'

// One icon + one semantic token per modality — never ad-hoc hex (§4). Colours are
// picked to never sit next to the same token: the type chip (vacancy tab) is
// --color-primary and the status chip is --color-info/--color-secondary depending
// on the tab, so modality uses --color-accent/--color-violet/--color-warning
// instead (measured collision, SCHERMWAARHEID-1 repair, 04-09).
const MODALITY_ICON: Record<Modality, typeof Building2> = {
  office: Building2, remote: Video, phone: Phone,
}
const MODALITY_COLOR: Record<Modality, string> = {
  office: 'var(--color-accent)', remote: 'var(--color-violet)', phone: 'var(--color-warning)',
}

// The modality VALUE, tinted (never a stand-in for the location/link DETAIL below it).
export default function ModalityChip({ modality, size }: { modality?: string | null; size?: number }) {
  const { t } = useTranslation('common')
  if (modality !== 'office' && modality !== 'remote' && modality !== 'phone') return null
  const Icon = MODALITY_ICON[modality]
  const color = MODALITY_COLOR[modality]
  return (
    <SoftChip color={color} size={size}
      label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon size={11} /> {t(`appointmentModality.${modality}`)}
      </span>} />
  )
}
