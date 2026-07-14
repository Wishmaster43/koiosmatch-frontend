import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import type { VacancyLinkOption } from '../hooks/useVacancyLinkOptions'

type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

/**
 * VacancyLinkField — the shared searchable vacancy picker used by both the
 * application Details block (ApplicationTab) and the Vacature tab's "Vacature
 * koppelen" flow (VacancyTab) — one look, one behaviour, never a per-tab fork
 * (§3A). A leading "no vacancy" option is the ontkoppelen affordance (empty
 * string = unlinked); allowCreate stays off — a vacancy is picked, never
 * created here. Options read "title · client" (mirrors the candidate direct-
 * match picker, useVacancyOptions). The caller's wrapper must NOT clip
 * overflow while this is open — the dropdown would be cut off (§3A(c)).
 */
export default function VacancyLinkField({ value, options, onChange, menuWidth = 280 }: {
  value: string
  options: VacancyLinkOption[]
  onChange: (v: string) => void
  menuWidth?: number
}) {
  const { t } = useTranslation('applications')
  const opts = [
    { value: '', label: t('drawer.noVacancy') },
    ...options.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label })),
  ]
  return (
    <CreatableSelect allowCreate={false} value={value} onChange={onChange}
      placeholder={t('drawer.pickVacancy')} menuWidth={menuWidth} options={opts} />
  )
}
