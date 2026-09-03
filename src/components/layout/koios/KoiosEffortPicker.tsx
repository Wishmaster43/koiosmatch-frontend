/**
 * KoiosEffortPicker — the per-chat reasoning-effort override in the composer
 * toolbar (K-147). Reads the tenant's effort block from /ai/koios/capabilities
 * (CMBE 04-09: supported · options · default · max) so it never offers a level the
 * package would reject with a 422: hidden entirely when unsupported, levels above
 * the ceiling dropped, the tenant default named on the 'Standaard' option. Support is
 * per MODEL (Snel = Haiku has no effort scale), so the chosen flavour decides via
 * `supported_by_flavor` once the server sends it (bundle H). Null =
 * send nothing (koiosApi.sendChat adds `effort` only when set).
 */
import { useId } from 'react'
import SelectMenu from '@/components/ui/SelectMenu'
import type { TFn } from '@/types/koios'
import { KOIOS_EFFORT_LEVELS, type KoiosEffort } from './koiosTypes'
import { useKoiosToolCapabilities } from './useKoiosToolCapabilities'

// Position on the ascending scale; an unknown level ranks lowest so it is never offered above the ceiling.
const rank = (level: string) => KOIOS_EFFORT_LEVELS.indexOf(level as KoiosEffort)

export default function KoiosEffortPicker({ value, onChange, flavor, t }: {
  value: KoiosEffort | null; onChange: (v: KoiosEffort | null) => void; flavor?: string | null; t: TFn
}) {
  const { capabilities } = useKoiosToolCapabilities()
  // The sr-only label the trigger points at, so its name reads "Inspanning: Hoog" (§6).
  const labelId = useId()
  const effort = capabilities?.effort
  // Support is per model: the chosen flavour's own answer when the server gives one, else the default flavour's.
  const supported = (flavor && effort?.supported_by_flavor?.[flavor]) ?? effort?.supported
  if (!effort || !supported) return null

  // Only the levels the package allows, in scale order; '' is the explicit clear (tenant default).
  const ceiling = rank(effort.max)
  const levels = (effort.options ?? KOIOS_EFFORT_LEVELS).filter((l) => rank(l) >= 0 && rank(l) <= ceiling)
  const options = [
    { value: '', label: t('koios.effort.defaultWith', { level: t(`koios.effort.${effort.default}`) }) },
    ...levels.map((l) => ({ value: l, label: t(`koios.effort.${l}`) })),
  ]

  return (
    <>
      <span id={labelId} className="sr-only">{t('koios.effort.label')}</span>
      <SelectMenu
        aria-labelledby={labelId}
        value={value ?? ''}
        options={options}
        onChange={(v) => onChange(v === '' ? null : (v as KoiosEffort))}
        menuWidth={150}
        style={{ width: 'auto', maxWidth: 150 }}
      />
    </>
  )
}
