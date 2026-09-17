/**
 * canvas ModuleNode · "not executable" marker (PICKER-INTERSECT) — a SAVED node
 * whose type the backend engine dropped support for renders an honest top-left
 * marker instead of disappearing; the node itself always keeps rendering fully.
 * Covers: a type missing from a non-empty catalog gets the marker, a type present
 * does not, a trigger-role type (registry category 'Triggers') never does, and an
 * empty catalog (still loading / fetch failed soft) never marks anything — a false
 * positive on every node while offline would be worse than no marker at all.
 *
 * @xyflow/react's Handle/Position are mocked out: ModuleNode only uses them for its
 * decorative connector dots, which need the real ReactFlow store/provider to render
 * — irrelevant to this marker and out of scope here.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NODE_TYPES, OutputPanel } from './canvas'
import { MODULE_META } from '@/modules/index'
import type { FlowNodeData } from '@/types/workflow'
import type { ModuleCatalog } from './filterFieldCatalog'

// ModuleNode only reads Handle/Position for its connector dots (decoration,
// irrelevant here) — stubbing them out avoids needing a real ReactFlowProvider.
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))

// Real i18n is not initialized here (mirrors configPanelRequired.test.tsx) so `t()`
// returns the raw key/defaultValue. ModuleNode now also pulls in useNumberFormat
// (@/lib/formatters -> @/lib/datetime -> @/i18n), which self-initializes the real
// i18next singleton as a module side effect (DATETIME-IMPORT-LES) — mocking the
// hook here keeps this file's raw-key assertions honest regardless of that import.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k, i18n: { language: 'nl' } }),
}))
// @/i18n self-initializes real i18next as a side effect on import (its own
// `i18n.use(initReactI18next).init(...)`), which crashes under the mock above
// (no initReactI18next export) — see lib/countries.ts's file-header note.
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))

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

const ModuleNode = NODE_TYPES.module

// Minimal saved-node shape: only `data.type` drives the marker logic under test.
const node = (type: string): { id: string; data: FlowNodeData } => ({ id: 'n1', data: { type } })

describe('ModuleNode · PICKER-INTERSECT "not executable" marker', () => {
  it('marks a saved node whose type is missing from a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    // 'condition' is a real FE-only spookmodule — absent from the engine's map.
    render(<ModuleNode {...node('condition')} />)
    expect(screen.getByLabelText('canvas.notExecutable')).toBeInTheDocument()
  })

  it('renders no marker when the type IS present in a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    render(<ModuleNode {...node('candidates')} />)
    expect(screen.queryByLabelText('canvas.notExecutable')).not.toBeInTheDocument()
  })

  it('never marks a trigger-role type even when missing from a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    // 'webhook' (category 'Triggers') starts a run — it is never an engine action.
    render(<ModuleNode {...node('webhook')} />)
    expect(screen.queryByLabelText('canvas.notExecutable')).not.toBeInTheDocument()
  })

  it('never marks anything while the catalog is empty (still loading / fetch failed soft)', () => {
    mockCatalog = {}
    render(<ModuleNode {...node('condition')} />)
    expect(screen.queryByLabelText('canvas.notExecutable')).not.toBeInTheDocument()
  })
})

// WF-MODULE-RECONCILE-FE-1 — the eight engine modules that used to fall through
// to the "Onbekende module" fallback (no MODULE_META entry → knownMeta undefined
// → nodeLabel = t('canvas.unknownModule')) because they had no FE registry card.
// A saved workflow like "Heractivering" (task_create at step 3) rendered exactly
// that. Each type below must now resolve knownMeta and render its real label.
const RECONCILED_TYPES = [
  'task_create', 'appointment_create', 'calllist_add', 'webhook_send',
  'candidate_archive', 'experience_add', 'sm_employee_create', 'workflow_call',
]

describe('ModuleNode · WF-MODULE-RECONCILE-FE-1 (no more "Onbekende module")', () => {
  it.each(RECONCILED_TYPES)('renders the real label for a saved %s node, never the unknown-module fallback', (type) => {
    mockCatalog = {}
    render(<ModuleNode {...node(type)} />)
    // i18next has no instance in this test environment (see setup.js) — t() falls
    // back to `defaultValue`, so a resolved registry entry renders its raw source
    // label; an unresolved one would render the literal key 'canvas.unknownModule'.
    expect(screen.getByText(MODULE_META[type].label)).toBeInTheDocument()
    expect(screen.queryByText('canvas.unknownModule')).not.toBeInTheDocument()
  })
})

// D8 audit fix: the Make-style counter badge must never render a literal "0"
// (§16 CANON-CHECKLIST "a counter badge never renders '0'") and must run the
// value through the house number formatter (GETALLEN-1).
describe('ModuleNode · counter badge never shows "0"', () => {
  it('renders no badge when a finished step processed zero items', () => {
    mockCatalog = realCatalog('candidates')
    render(<ModuleNode id="n1" data={{ type: 'candidates', status: 'success', itemsTotal: 0 } as unknown as FlowNodeData} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders the formatted count when a finished step processed items', () => {
    mockCatalog = realCatalog('candidates')
    render(<ModuleNode id="n1" data={{ type: 'candidates', status: 'success', itemsTotal: 1234 } as unknown as FlowNodeData} />)
    expect(screen.getByText('1.234')).toBeInTheDocument()
  })
})

// POPUP-AUDIT-1: OutputPanel migrated onto the shared FloatingPanel shell —
// still a real modal (default overlay), drag handle + resize grip present,
// content (OutputTree over the raw output) unchanged.
describe('OutputPanel · POPUP-AUDIT-1 FloatingPanel migration', () => {
  it('renders inside FloatingPanel chrome and the close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OutputPanel output={[{ id: 1 }, { id: 2 }]} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.querySelector('[data-drag-handle]')).toBeInTheDocument()
    expect(document.querySelector('[aria-hidden][style*="nwse-resize"]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
