// error_commit module — error handler: commit the current transaction and stop on error.
import { CheckCircle2 } from 'lucide-react'

export default {
  type:     'error_commit',
  category: 'Foutafhandeling',
  label:    'Vastleggen (Commit)',
  Icon:     CheckCircle2,
  color:    'var(--color-secondary)',
  bg:       'var(--color-secondary-bg)',
  schema: [
    { key: 'info', label: 'Werking', type: 'textarea', placeholder: 'Alle tot nu toe verwerkte bundles worden als succesvol gemarkeerd. De foutieve bundle en alles daarna wordt overgeslagen.' },
  ],
}
