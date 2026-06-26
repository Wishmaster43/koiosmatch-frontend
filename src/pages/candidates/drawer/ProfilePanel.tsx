import ProfileTab from './ProfileTab'
import KoiosAiBlock from './KoiosAiBlock'
import LanguagesSection from './LanguagesSection'
import DocumentsSection from './DocumentsSection'
import BranchSection from './BranchSection'
import PoolsSection from './PoolsSection'
import type { Candidate } from '@/types/candidate'

/** Profile tab — profile fields + AI block + languages + documents + branch.
 * Each block owns its own edit state (in-place pencil ↔ save). */
export default function ProfilePanel({ c, onEditSave }: { c: Candidate; onEditSave?: (v: Record<string, unknown>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ProfileTab c={c} onEditSave={onEditSave} />
      <KoiosAiBlock c={c} />
      <LanguagesSection c={c} onEditSave={onEditSave} />
      <DocumentsSection c={c} />
      <PoolsSection c={c} />
      <BranchSection c={c} />
    </div>
  )
}
