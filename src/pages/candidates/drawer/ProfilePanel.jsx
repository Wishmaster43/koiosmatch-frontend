import { useState } from 'react'
import ProfileTab from './ProfileTab'
import KoiosAiBlock from './KoiosAiBlock'
import { LanguageTab } from './SectionTabs'
import DocumentsSection from './DocumentsSection'
import BranchSection from './BranchSection'
import PoolsSection from './PoolsSection'

/** Profile tab — profile fields + AI block + languages + documents + branch.
 * ProfileTab owns its own edit state (in-place pencil ↔ save). */
export default function ProfilePanel({ c, onEditSave }) {
  const [languages, setLanguages] = useState(c.languages ?? [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ProfileTab c={c} onEditSave={onEditSave} />
      <KoiosAiBlock c={c} />
      <LanguageTab items={languages} onAdd={v => setLanguages(p => [...p, v])} />
      <DocumentsSection c={c} />
      <PoolsSection c={c} />
      <BranchSection c={c} />
    </div>
  )
}
