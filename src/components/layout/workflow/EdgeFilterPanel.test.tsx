/**
 * EdgeFilterPanel — behaviour tests for the real editor UI (mount, not just the
 * pure serialization helpers). Real i18n is NOT initialized (mirrors
 * ScheduleModal.test.tsx / configPanelWaWeb.test.tsx), so every label renders as
 * its raw i18n key — assertions target those raw keys and the module's own
 * data (field/operator labels), never translated copy.
 *
 * Covers: picking a field from the upstream catalogue (FILTER-VELD-1), picking
 * an operator, typing a value, saving a single AND-group; adding a second
 * OR-group and a second condition inside it; removing a condition. Each save
 * assertion checks the exact `onSave(filters, label)` call the parent's
 * saveEdgeFilter would persist onto the edge (serialization.ts's
 * edgeFilterGroupsToFilters contract) — never only that onSave fired.
 *
 * CreatableSelect's closed trigger is a <button> whose accessible name is its
 * own visible text (no aria-label/labelledby on the field picker) — the
 * `placeholder` ATTRIBUTE only exists on the search input inside the OPEN
 * portalled menu. So an unselected field picker is located via its button's
 * accessible NAME ('fields.fieldPlaceholder'), never getByPlaceholderText.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeFilterPanel } from './EdgeFilterPanel'
import type { ModuleCatalog } from './filterFieldCatalog'
import type { FlowNode, FlowEdge } from '@/types/workflow'

// One replace-emitting upstream module so the field picker has real options —
// mirrors filterFieldCatalog.test.ts's fixture shape.
const catalog: ModuleCatalog = {
  candidate_filter: { emits: 'replace', outputFields: { id: 'Kandidaat-ID', firstname: 'Voornaam' } },
}
const nodes: FlowNode[] = [{ id: 'a', position: { x: 0, y: 0 }, data: { type: 'candidate_filter', config: {} } }]
const edges: FlowEdge[] = []

// Renders the panel wired to node 'a' as the edge's source, so the field
// picker's options come from the catalogue above (1. <module> · <field>).
function setup(overrides: Partial<Parameters<typeof EdgeFilterPanel>[0]> = {}) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<EdgeFilterPanel sourceNodeId="a" nodes={nodes} edges={edges} catalog={catalog}
    onClose={onClose} onSave={onSave} {...overrides} />)
  return { onSave, onClose }
}

// Opens the first still-EMPTY field picker (its button's accessible name is
// the raw placeholder key until a value is picked) and selects `label`.
function pickField(label: string) {
  const trigger = screen.getAllByRole('button', { name: 'fields.fieldPlaceholder' })[0]
  fireEvent.click(trigger)
  fireEvent.click(screen.getByText(label))
}

// Opens the Nth OperatorSelect. Its accessible name is the sr-only label
// PLUS the button's own current-value text concatenated (CreatableSelect
// points aria-labelledby at both the label span and its own id, see that
// component's doc comment) — so match on the 'fields.operator' PREFIX, not
// an exact name, and pick by index (every row's trigger starts with it).
function pickOperator(index: number, optionText: string) {
  const triggers = screen.getAllByRole('button', { name: /^fields\.operator/ })
  fireEvent.click(triggers[index])
  fireEvent.click(screen.getByText(optionText))
}

describe('EdgeFilterPanel · single condition', () => {
  it('adding a condition, picking a catalogue field + operator + value, then saving persists the exact AND-group shape', () => {
    const { onSave, onClose } = setup()

    // No condition row exists until "+ add condition" is clicked (groups start as [[]]).
    expect(screen.queryByRole('button', { name: 'fields.fieldPlaceholder' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('fields.addCondition'))
    expect(screen.getByRole('button', { name: 'fields.fieldPlaceholder' })).toBeInTheDocument()

    // The catalogue offers the upstream module's own output fields (FILTER-VELD-1).
    fireEvent.click(screen.getByRole('button', { name: 'fields.fieldPlaceholder' }))
    expect(screen.getByText('1. Kandidaten ophalen · Kandidaat-ID')).toBeInTheDocument()
    expect(screen.getByText('1. Kandidaten ophalen · Voornaam')).toBeInTheDocument()
    fireEvent.click(screen.getByText('1. Kandidaten ophalen · Voornaam'))

    // Default operator is '=' (text group); switch it to "contains".
    pickOperator(0, 'canvas.opGroupText · canvas.opContains')

    fireEvent.change(screen.getByPlaceholderText('fields.valuePlaceholder'), { target: { value: 'Anna' } })

    fireEvent.click(screen.getByText('common:save'))
    expect(onSave).toHaveBeenCalledTimes(1)
    const [filters, label] = onSave.mock.calls[0]
    expect(filters).toEqual({ conditions: [{ field: 'firstname', operator: 'contains', value: 'Anna' }], logic: 'AND' })
    expect(label).toBe('')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('hides the value input for a valueless operator (empty/not_empty)', () => {
    setup()
    fireEvent.click(screen.getByText('fields.addCondition'))
    pickOperator(0, 'canvas.opGroupText · canvas.opEmpty')
    expect(screen.queryByPlaceholderText('fields.valuePlaceholder')).not.toBeInTheDocument()
  })

  // F5 (ROUTER-EDGE-FILTERS-1/D7): an emptied group persists as `null`, not the
  // empty-but-truthy `{conditions:[],logic:'AND'}` shape (the backend read that
  // as "this route is filtered" even though it gates nothing).
  it('removing the only condition in a group leaves the group empty (no crash), and a save with nothing filled persists null', () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByText('fields.addCondition'))
    fireEvent.click(screen.getByLabelText('canvas.deleteCondition'))
    expect(screen.queryByRole('button', { name: 'fields.fieldPlaceholder' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('common:save'))
    expect(onSave).toHaveBeenCalledWith(null, '')
  })
})

describe('EdgeFilterPanel · OR groups', () => {
  it('adding a second OR-group with its own condition persists the nested [[…],[…]] shape', () => {
    const { onSave } = setup()

    // Group 1: firstname = x
    fireEvent.click(screen.getByText('fields.addCondition'))
    pickField('1. Kandidaten ophalen · Voornaam')
    fireEvent.change(screen.getByPlaceholderText('fields.valuePlaceholder'), { target: { value: 'x' } })

    // "+ OF-groep" adds a second, initially-empty AND-group.
    fireEvent.click(screen.getByText('canvas.addGroup'))
    expect(screen.getByText('canvas.orDivider')).toBeInTheDocument()
    // Group 2's own "+ add condition" is the second one on the page now.
    const addButtons = screen.getAllByText('fields.addCondition')
    expect(addButtons).toHaveLength(2)
    fireEvent.click(addButtons[1])

    // Group 1's field is already picked, so the only remaining EMPTY picker is group 2's.
    pickField('1. Kandidaten ophalen · Kandidaat-ID')
    const values = screen.getAllByPlaceholderText('fields.valuePlaceholder')
    expect(values).toHaveLength(2)
    fireEvent.change(values[1], { target: { value: 'id-1' } })

    fireEvent.click(screen.getByText('common:save'))
    const [filters] = onSave.mock.calls[0]
    expect(filters).toEqual([
      [{ field: 'firstname', operator: '=', value: 'x' }],
      [{ field: 'id', operator: '=', value: 'id-1' }],
    ])
  })

  it('a second condition inside the SAME group is AND-combined (flat single-group shape)', () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByText('fields.addCondition'))
    pickField('1. Kandidaten ophalen · Voornaam')
    fireEvent.change(screen.getByPlaceholderText('fields.valuePlaceholder'), { target: { value: 'Anna' } })

    // A second "+ add condition" click (still only one group on the page) adds
    // a second row to the SAME group.
    fireEvent.click(screen.getByText('fields.addCondition'))
    pickField('1. Kandidaten ophalen · Kandidaat-ID')
    const values = screen.getAllByPlaceholderText('fields.valuePlaceholder')
    expect(values).toHaveLength(2)
    fireEvent.change(values[1], { target: { value: 'id-2' } })

    fireEvent.click(screen.getByText('common:save'))
    const [filters] = onSave.mock.calls[0]
    expect(filters).toEqual({
      conditions: [
        { field: 'firstname', operator: '=', value: 'Anna' },
        { field: 'id', operator: '=', value: 'id-2' },
      ],
      logic: 'AND',
    })
  })

  it('removing a whole OR-group (Trash2 on the group header) folds back to the single-group flat shape', () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByText('fields.addCondition'))
    pickField('1. Kandidaten ophalen · Voornaam')
    fireEvent.change(screen.getByPlaceholderText('fields.valuePlaceholder'), { target: { value: 'x' } })
    fireEvent.click(screen.getByText('canvas.addGroup'))
    expect(screen.getAllByText(/canvas\.groupLabel/)).toHaveLength(2)

    // Both group headers show a trash button once ≥2 groups exist — remove group 2's (the second one).
    const removeButtons = screen.getAllByLabelText('canvas.removeGroup')
    expect(removeButtons).toHaveLength(2)
    fireEvent.click(removeButtons[1])
    expect(screen.queryByText('canvas.orDivider')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('common:save'))
    expect(onSave).toHaveBeenCalledWith({ conditions: [{ field: 'firstname', operator: '=', value: 'x' }], logic: 'AND' }, '')
  })
})

describe('EdgeFilterPanel · route name + prefilled state', () => {
  it('prefills the route-name input and the groups from persisted filters, and an edited name is trimmed on save', () => {
    const { onSave } = setup({
      label: '  Kort-traject  ',
      filters: { conditions: [{ field: 'firstname', operator: '=', value: 'Anna' }], logic: 'AND' },
    })
    expect(screen.getByLabelText('canvas.routeName')).toHaveValue('  Kort-traject  ')
    // The prefilled condition's field is already resolved (not the placeholder name).
    expect(screen.getByRole('button', { name: '1. Kandidaten ophalen · Voornaam' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('fields.valuePlaceholder')).toHaveValue('Anna')

    fireEvent.change(screen.getByLabelText('canvas.routeName'), { target: { value: '  Nieuwe naam  ' } })
    fireEvent.click(screen.getByText('common:save'))
    const [, label] = onSave.mock.calls[0]
    expect(label).toBe('Nieuwe naam')
  })
})

describe('EdgeFilterPanel · no graph supplied', () => {
  it('still renders and saves (empty field options) when sourceNodeId/nodes/edges/catalog are omitted', () => {
    const onSave = vi.fn()
    render(<EdgeFilterPanel onClose={vi.fn()} onSave={onSave} />)
    fireEvent.click(screen.getByText('fields.addCondition'))
    fireEvent.click(screen.getByText('common:save'))
    expect(onSave).toHaveBeenCalledWith({ conditions: [{ field: '', operator: '=', value: '' }], logic: 'AND' }, '')
  })
})
