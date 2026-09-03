/**
 * PermissionMatrix — transfer-family group rendering (K-236 FE). The six AVG
 * rights arrive from GET /permissions as three NEW groups (notes /
 * conversations / documents); the matrix labels groups via roles.groups.<key>
 * and actions via roles.actions.<key>, falling back to the RAW key when a
 * translation is missing (§5: a raw key on screen is a finding). This pins the
 * labels added in 066e1b5d so the fallback path can never silently return.
 * Also pins `candidates.export-financial` (CAND-IMPORT-FE-1 residual,
 * measured 03-09): the seeded permission reached the matrix with no
 * roles.actions.export-financial key, so it rendered as the raw key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n runtime — assertions check the actual translated nl copy.
import '@/i18n'
import { PermissionMatrix } from './RolesPermissionMatrix'
import type { PermissionGroups } from './RolesPermissionMatrix'

// The three family groups exactly as the permission catalog serves them.
const GROUPS: PermissionGroups = [
  ['notes', [{ name: 'notes.export' }, { name: 'notes.import' }]],
  ['conversations', [{ name: 'conversations.export' }, { name: 'conversations.import' }]],
  ['documents', [{ name: 'documents.export' }, { name: 'documents.import' }]],
]

// The candidates group as GET /permissions serves it, carrying the seeded
// `candidates.export-financial` right alongside the ordinary CRUD verbs.
const CANDIDATES_GROUP: PermissionGroups = [
  ['candidates', [{ name: 'candidates.view' }, { name: 'candidates.export-financial' }]],
]

describe('PermissionMatrix — transfer-family groups', () => {
  it('renders the three family groups with translated labels, never raw keys', () => {
    render(<PermissionMatrix groups={GROUPS} hasPermission={() => true} onToggle={vi.fn()} />)

    for (const label of ['Notities', 'Conversaties', 'Documenten']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Raw group keys must not appear anywhere as visible text.
    expect(screen.queryByText('notes')).toBeNull()
    expect(screen.queryByText('conversations')).toBeNull()
  })

  it('shows translated Export/Import toggles inside an expanded family group', () => {
    render(<PermissionMatrix groups={GROUPS} hasPermission={() => true} onToggle={vi.fn()} />)

    // Expand the Notities group row, then both action toggles carry real labels.
    fireEvent.click(screen.getByText('Notities'))
    expect(screen.getByText('Exporteren')).toBeInTheDocument()
    expect(screen.getByText('Importeren')).toBeInTheDocument()
  })

  it('shows the translated export-financial toggle, never the raw permission key', () => {
    render(<PermissionMatrix groups={CANDIDATES_GROUP} hasPermission={() => true} onToggle={vi.fn()} />)

    // Expand the Kandidaten group row to reveal the export-financial toggle.
    fireEvent.click(screen.getByText('Kandidaten'))
    expect(screen.getByText('Financiële export')).toBeInTheDocument()
    expect(screen.queryByText('export-financial')).toBeNull()
    expect(screen.queryByText('candidates.export-financial')).toBeNull()
  })
})
