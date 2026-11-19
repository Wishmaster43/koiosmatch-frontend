// backoffice_sync module — couple the pipeline's candidates (or another entity from the
// trigger context) to a backoffice: HelloFlex or Shiftmanager. One module, the system is
// config; the seeded single/bulk koppel-scenarios in the Kandidaten folder use it
// (BACKOFFICE-SCENARIO-1). only_unlinked guards bulk runs against re-queueing records
// that already carry a linked external id in the mappings table (no doubles — Danny).
import { Link2 } from 'lucide-react'

export default {
  type:     'backoffice_sync',
  // CONNECTOR-VS-REPORTING-1 (Danny 19-11): a connector WRITE step gated on the connector APPS only
  // (no package module: WorkflowWriter::MODULE_REQUIRES no longer names it, the BE checks the connector
  // predicate per step-config `system` through ConnectorRequirements, BE CONNECTOR-VS-REPORTING-BE-1).
  label:    'Link to backoffice',
  category: 'candidates',
  Icon:     Link2,
  color:    'var(--module-cyan)',
  bg:       'var(--color-info-bg)',
  // Either connector app offers it (MODULE_APP_MAP is any-of).
  app:      ['hf', 'shiftmanager'],
  schema: [
    // Required: BE D-M1 answers 422 workflow.backoffice_sync_system_unknown for an empty or unknown system.
    { key: 'system', label: 'System', type: 'select', required: true, options: ['helloflex', 'shiftmanager'] },
    { key: 'include_children', label: 'Including child locations/departments/contacts', type: 'boolean', help: 'Only relevant when the linked entity is a customer.' },
    { key: 'only_unlinked', label: 'Only not yet linked', type: 'boolean', help: 'Skip records that already have a link with this system. Recommended for bulk.' },
  ],
}
