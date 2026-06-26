// condition module — branch the workflow on a simple field comparison (Fase 1 engine).
import { GitBranch } from 'lucide-react'

export default {
  type:  'condition',
  category: 'Flow beheer',
  label: 'Voorwaarde / vertakking',
  Icon:  GitBranch,
  color: '#5FB0AC',
  bg:    '#E5F4F2',
  schema: [
    { key: 'field',    label: 'Veld',     type: 'text',   placeholder: 'status' },
    { key: 'operator', label: 'Operator', type: 'select', options: ['eq', 'neq', 'gt', 'lt', 'in'] },
    { key: 'value',    label: 'Waarde',   type: 'text' },
  ],
}
