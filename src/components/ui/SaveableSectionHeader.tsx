import type { CSSProperties, ReactNode } from 'react'
import SaveButton from './SaveButton'

// A section's title/subtitle on the left and its SaveButton on the right — the
// same layout used by VacancyMatchingSettings and MatchingTab (DRY, jscpd clone
// found during JSX2TS-FE lane D). `title` stays a caller-built element so each
// site keeps its own typography atom (PageTitle vs SectionTitle).
interface SaveableSectionHeaderProps {
  title: ReactNode
  subtitle: string
  saved: boolean
  onSave: () => void
  savedLabel: ReactNode
  saveLabel: ReactNode
  disabled?: boolean
  buttonStyle?: CSSProperties
  wrapperClassName?: string
  wrapperStyle?: CSSProperties
}

export default function SaveableSectionHeader({
  title, subtitle, saved, onSave, savedLabel, saveLabel, disabled, buttonStyle,
  wrapperClassName, wrapperStyle,
}: SaveableSectionHeaderProps) {
  return (
    <div className={wrapperClassName}
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, ...wrapperStyle }}>
      <div style={{ minWidth: 0 }}>
        {title}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>
      </div>
      <SaveButton saved={saved} onClick={onSave} disabled={disabled} style={buttonStyle}>
        {saved ? savedLabel : saveLabel}
      </SaveButton>
    </div>
  )
}
