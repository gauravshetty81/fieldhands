import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fh_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fh_token')
      localStorage.removeItem('fh_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:        number
  username:  string
  full_name: string | null
  email:     string | null
  role:      'owner' | 'co_owner' | 'caretaker' | 'accountant' | 'viewer'
}

export interface LandProfile {
  id:            number
  name:          string
  location:      string | null
  district:      string | null
  state:         string | null
  area_acres:    number | null
  gps_lat:       number | null
  gps_lng:       number | null
  survey_number: string | null
  notes:         string | null
}

export interface Crop {
  id:           number
  name:         string
  variety:      string | null
  count:        number | null
}

export interface Weather {
  temperature_c:    number | null
  humidity_pct:     number | null
  precipitation_mm: number | null
  wind_speed_kmh:   number | null
  weather_code:     number | null
}

export interface Financials {
  income_this_month:   number
  expenses_this_month: number
  net_pl:              number
  currency:            string
}

export interface ActivityEntry {
  module:      string
  action:      string
  description: string | null
  by:          string
  at:          string | null
}

export interface Module {
  id:    string
  label: string
  icon:  string
  path:  string
}

export interface DashboardData {
  land:       LandProfile | null
  crops:      Crop[]
  financials: Financials | null
  activity:   ActivityEntry[]
  weather:    Weather | null
  modules:    Module[]
}
