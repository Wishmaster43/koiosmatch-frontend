// error_commit module — error handler: commit the current transaction and stop on error.
import { CheckCircle2 } from 'lucide-react'

export default {
  type:     'error_commit',
  category: 'flow',
  label:    'Commit',
  Icon:     CheckCircle2,
  color:    'var(--color-secondary)',
  bg:       'var(--color-secondary-bg)',
  schema: [
    // D8: read-only behaviour note (no effect on the run) — renders via the 'help_text' field type, never an editable control.
    { key: 'info', label: 'Behaviour', type: 'help_text', placeholder: 'All bundles processed so far are marked successful. The failing bundle and everything after it is skipped.' },
  ],
}
