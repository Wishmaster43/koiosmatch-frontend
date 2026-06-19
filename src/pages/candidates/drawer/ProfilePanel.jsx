import { useState } from 'react'
import ProfileTab from './ProfileTab'
import KoiosAiBlock from './KoiosAiBlock'
import { LanguageTab } from './SectionTabs'
import DocumentsSection from './DocumentsSection'
import BranchSection from './BranchSection'
import PoolsSection from './PoolsSection'

/** Profile tab — profile fields + AI block + languages + documents + branch.
 * `editing` stays controlled by the drawer (header Edit button). */
export default function ProfilePanel({ c, editing, onEditSave, onEditCancel, onStartEdit }) {
  const [languages, setLanguages] = useState(c.languages ?? [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ProfileTab c={c} editing={editing} onEditSave={onEditSave} onEditCancel={onEditCancel} onStartEdit={onStartEdit} />
      <KoiosAiBlock c={c} />
      <LanguageTab items={languages} onAdd={v => setLanguages(p => [...p, v])} />
      <DocumentsSection c={c} />
      <PoolsSection c={c} />
      <BranchSection c={c} />
    </div>
  )
}
