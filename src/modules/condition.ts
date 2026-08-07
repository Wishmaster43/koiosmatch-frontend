// condition module — branch the workflow on a simple field comparison (Fase 1 engine).
import { GitBranch } from 'lucide-react'

export default {
  type:  'condition',
  category: 'Flow beheer',
  label: 'Voorwaarde / vertakking',
  Icon:  GitBranch,
  color: 'var(--module-teal)',
  bg:    'color-mix(in srgb, var(--module-teal) 15%, transparent)',
  schema: [
    { key: 'field',    label: 'Veld',     type: 'text',   placeholder: 'status' },
    { key: 'operator', label: 'Operator', type: 'select', options: ['eq', 'neq', 'gt', 'lt', 'in'] },
    { key: 'value',    label: 'Waarde',   type: 'text' },
  ],
}
