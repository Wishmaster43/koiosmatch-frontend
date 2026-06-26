// intus_shifts module — HTTP call to the Intus API for shifts (diensten).
// Same fields as the generic HTTP Request, branded with the Intus mark.
import IntusMark from '../components/ui/IntusMark'

export default {
  type:  'intus_shifts',
  app:   'intus',
  category: 'Intus',
  label: 'Diensten',
  Icon:  IntusMark,
  color: '#0E3A53',
  bg:    '#E7EEF3',
  schema: [
    { key: 'url',    label: 'URL',    type: 'text',   placeholder: 'https://api.intus.example/shifts', required: true },
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
    { key: 'body',    label: 'Body (JSON)', type: 'textarea', placeholder: '{"key": "value"}' },
    { key: 'parse_response',    label: 'Response parsen',      type: 'boolean' },
    { key: 'allow_redirects',   label: 'Redirects volgen',     type: 'boolean' },
    { key: 'stop_on_http_error',label: 'Stop bij HTTP fout',   type: 'boolean' },
    { key: 'timeout', label: 'Timeout (sec)', type: 'number', placeholder: '30' },
  ],
}
