// http_request module — make a custom HTTP request to an external API.
import { Globe } from 'lucide-react'

export default {
  type:  'http_request',
  category: 'Integraties',
  label: 'HTTP Request',
  Icon:  Globe,
  color: '#0369A1',
  bg:    '#E0F2FE',
  schema: [
    { key: 'url',    label: 'URL',    type: 'text',   placeholder: 'https://api.example.com/endpoint', required: true },
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
