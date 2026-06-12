import axios from 'axios'

const api = axios.create({
  baseURL: 'http://koiosconnect-api.test/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token  = localStorage.getItem('auth_token')
  const tenant = localStorage.getItem('active_tenant')
  if (token)  config.headers.Authorization = `Bearer ${token}`
  if (tenant) config.headers['X-Tenant']   = tenant
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data)
    // tijdelijk: geen automatische redirect bij 401
    // if (error.response?.status === 401) {
    //   localStorage.removeItem('auth_token')
    //   localStorage.removeItem('auth_user')
    //   window.location.href = '/login'
    // }
    return Promise.reject(error)
  }
)

export default api