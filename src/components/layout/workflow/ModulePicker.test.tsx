/**
 * ModulePicker · executability gate (PICKER-INTERSECT) — the picker must only ever
 * OFFER a module type the backend engine can run. Covers the three contract points:
 * an empty catalog (still loading / fetch failed soft) degrades to "offer everything
 * the app/module gates already allowed", a non-empty catalog actually filters, and a
 * trigger-role module (registry category 'Triggers') stays exempt either way.
 *
 * AppsContext/AuthContext are mocked to explicitly DISABLE every app/module-gated
 * type (mirrors OpportunitiesTab.test.tsx's `hasModule: () => false` pattern) — this
 * isolates the NEW executability gate from the pre-existing app/module gates, so a
 * type appearing or vanishing in these tests is caused by the catalog, nothing else.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModulePicker from './ModulePicker'
import { MODULE_META } from '@/modules/index'
import type { ModuleCatalog } from './filterFieldCatalog'

// Every app/module-gated type is disabled, so only ungated registry entries survive
// isModuleEnabled — the fixed baseline the executability gate is layered on top of.
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: () => false }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: () => false }) }))

// The catalog the mocked hook hands back — each test sets it before rendering.
let mockCatalog: ModuleCatalog = {}
// Realistic non-empty catalog: the engine map carries ~40 types, and the
// component's shape floor (>= 5 keys) treats smaller responses as corruption —
// fixtures mirror that reality instead of a bare single-key map.
const entry = { outputFields: {}, emits: 'passthrough' } as const
const realCatalog = (...types: string[]): ModuleCatalog =>
  Object.fromEntries(['tasks', 'matches', 'vacancies', 'wait', 'router', ...types].map(t => [t, { ...entry }]))

vi.mock('./useModuleCatalog', () => ({
  useModuleCatalog: () => ({ catalog: mockCatalog, loading: false }),
}))

// 'candidates' and 'condition' are both ungated (no app/module requirement) and
// carry distinct labels — 'webhook' is the trigger-role reference (category
// 'Triggers'). All three are stable, unaffected by the AppsContext/AuthContext mocks.
const CANDIDATES_LABEL = MODULE_META.candidates.label
const CONDITION_LABEL = MODULE_META.condition.label
const WEBHOOK_LABEL = MODULE_META.webhook.label

const noop = () => {}

describe('ModulePicker · PICKER-INTERSECT executability gate', () => {
  it('offers everything the old gates allowed when the catalog is empty (fetch pending/failed)', () => {
    mockCatalog = {}
    render(<ModulePicker insertAfterEdgeId={null} onSelect={noop} onClose={noop} />)
    // Empty catalog carries no executability info — never filter on it.
    expect(screen.getByTitle(CANDIDATES_LABEL)).toBeInTheDocument()
    expect(screen.getByTitle(CONDITION_LABEL)).toBeInTheDocument()
  })

  it('treats a suspiciously tiny catalog as corruption, not signal (shape floor)', () => {
    // One stray key would otherwise strip ~67 of 68 modules (Opus F4).
    mockCatalog = { candidates: { outputFields: {}, emits: 'passthrough' } }
    render(<ModulePicker insertAfterEdgeId={null} onSelect={noop} onClose={noop} />)
    expect(screen.getByTitle(CONDITION_LABEL)).toBeInTheDocument()
  })

  it('hides a module type missing from a non-empty catalog, keeps one that is present', () => {
    mockCatalog = realCatalog('candidates')
    render(<ModulePicker insertAfterEdgeId={null} onSelect={noop} onClose={noop} />)
    expect(screen.getByTitle(CANDIDATES_LABEL)).toBeInTheDocument()
    // 'condition' is a real FE-only spookmodule — absent from the engine's map.
    expect(screen.queryByTitle(CONDITION_LABEL)).not.toBeInTheDocument()
  })

  it('keeps a trigger-role module offered even though it is missing from a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    render(<ModulePicker insertAfterEdgeId={null} onSelect={noop} onClose={noop} />)
    // 'webhook' (category 'Triggers') starts a run — it is never an engine action.
    expect(screen.getByTitle(WEBHOOK_LABEL)).toBeInTheDocument()
  })

  // FE orphan (CMBE 25-08): applicant_message has no backend module, so the
  // registry marks it `hidden` — the picker never offers it as a new node,
  // regardless of catalog state.
  it('never offers the hidden applicant_message module, empty or non-empty catalog', () => {
    const APPLICANT_MESSAGE_LABEL = MODULE_META.applicant_message.label
    mockCatalog = {}
    const { rerender } = render(<ModulePicker insertAfterEdgeId={null} onSelect={noop} onClose={noop} />)
    expect(screen.queryByTitle(APPLICANT_MESSAGE_LABEL)).not.toBeInTheDocument()
    mockCatalog = realCatalog('applicant_message')
    rerender(<ModulePicker insertAfterEdgeId={null} onSelect={noop} onClose={noop} />)
    expect(screen.queryByTitle(APPLICANT_MESSAGE_LABEL)).not.toBeInTheDocument()
  })
})
