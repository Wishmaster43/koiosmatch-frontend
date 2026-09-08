/**
 * intusFactory — module factory for creating identical Intus integration modules
 * (intus_candidates, intus_shifts), differing only in type and label.
 * Returns a fully configured module object matching the expected workflow schema.
 */
import IntusMark from '../components/ui/IntusMark'

/**
 * Create a module configuration for an Intus integration (candidates or shifts).
 * Both modules share identical schema and styling, differing only in type name and label;
 * the tinted background literal stays on the thin module file (its lint ceiling carries it).
 */
export function makeIntusModule(type: string, label: string, bg: string, urlPlaceholder: string) {
  return {
    type,
    app: 'intus',
    category: 'Intus',
    label,
    Icon: IntusMark,
    color: 'var(--module-intus)',
    bg,
    schema: [
      { key: 'url', label: 'URL', type: 'text', placeholder: urlPlaceholder, required: true },
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], required: true },
      { key: 'authentication_type', label: 'Authenticatie', type: 'select', options: ['Geen', 'API Key', 'Basic Auth', 'OAuth'] },
      {
        key: 'headers', label: 'Headers', type: 'keyvalue',
        help: 'Naam / Waarde paren',
      },
      {
        key: 'query_params', label: 'Query parameters', type: 'keyvalue',
        help: 'Naam / Waarde paren',
      },
      { key: 'body_type', label: 'Body type', type: 'select', options: ['Geen', 'JSON', 'Form (urlencoded)', 'Multipart', 'Custom'] },
      { key: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{"key": "value"}' },
      { key: 'parse_response', label: 'Response parsen', type: 'boolean' },
      { key: 'allow_redirects', label: 'Redirects volgen', type: 'boolean' },
      { key: 'stop_on_http_error', label: 'Stop bij HTTP fout', type: 'boolean' },
      { key: 'timeout', label: 'Timeout (sec)', type: 'number', placeholder: '30' },
    ],
  }
}
