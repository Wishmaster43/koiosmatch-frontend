/**
 * SingleLookupSettingCard — the shared "one tenant-setting bound to a single
 * lookup picker" screen: title + subtitle + SettingLookupPicker. Every string
 * is resolved by the caller's own t() (i18n stays per-consumer); this component
 * only owns the layout and the picker wiring (DRY round 11, SETTINGS2).
 */
import SettingLookupPicker from '../components/SettingLookupPicker'
import { SectionTitle, PageSubtitle } from '@/components/ui/typography'
import SettingsLoadBanner from '../components/SettingsLoadBanner'

interface SingleLookupSettingCardProps {
  title: string
  subtitle: string
  options: Array<{ value: string; label: string }>
  value: string
  onPick: (next: string) => Promise<void> | void
  loaded: boolean
  noneLabel: string
}

export default function SingleLookupSettingCard({
  title, subtitle, options, value, onPick, loaded, noneLabel,
}: SingleLookupSettingCardProps) {
  return (
    <div style={{ maxWidth: 560 }}>
      <SettingsLoadBanner />
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{title}</SectionTitle>
      <PageSubtitle as="div" style={{ marginBottom: 12 }}>{subtitle}</PageSubtitle>
      {/* Searchable single-pick dropdown, like every other lookup filter (Danny 23-07). */}
      <SettingLookupPicker
        options={options}
        value={value}
        onPick={onPick}
        disabled={!loaded}
        width={300}
        noneLabel={noneLabel}
      />
    </div>
  )
}
