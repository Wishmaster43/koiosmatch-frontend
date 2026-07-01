import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextFieldWithVars } from './VariablePicker'
import type { WorkflowField, WorkflowVarGroup } from '@/types/workflow'

const field: WorkflowField = { key: 'input', label: 'Input', type: 'textarea' }
const variables: WorkflowVarGroup[] = [
  { nodeId: 'n1', moduleType: 'http', hasRun: true, fields: [
    { token: '{{n1.id}}',   label: 'id',   sample: '13' },
    { token: '{{n1.name}}', label: 'name', sample: 'Mark' },
  ] },
]

beforeAll(() => {
  // The caret restore uses requestAnimationFrame; jsdom may not provide it.
  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 }
  }
})

describe('TextFieldWithVars', () => {
  it('opens the picker and lists upstream fields', () => {
    render(<TextFieldWithVars field={field} value="" onChange={() => {}} variables={variables} multiline />)
    fireEvent.click(screen.getByLabelText('vars.title'))
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
  })

  it('inserts the chosen token via onChange', () => {
    const onChange = vi.fn()
    render(<TextFieldWithVars field={field} value="Hi " onChange={onChange} variables={variables} multiline />)
    fireEvent.click(screen.getByLabelText('vars.title'))
    fireEvent.click(screen.getByText('id'))
    expect(onChange).toHaveBeenCalledWith('input', expect.stringContaining('{{n1.id}}'))
  })

  it('filters the field list by the search query', () => {
    render(<TextFieldWithVars field={field} value="" onChange={() => {}} variables={variables} multiline />)
    fireEvent.click(screen.getByLabelText('vars.title'))
    fireEvent.change(screen.getByLabelText('vars.search'), { target: { value: 'name' } })
    expect(screen.queryByText('id')).toBeNull()
    expect(screen.getByText('name')).toBeInTheDocument()
  })
})
