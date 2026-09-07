import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// ---- Auto-refresh sesi ----
// Access JWT pendek (2h). Saat 401, coba tukar refresh token -> token baru, lalu ulangi request.
// Antrean menahan request lain selama refresh berjalan (hindari refresh ganda paralel).
let refreshing = null

const clearSession = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

async function refreshSession() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return null

  try {
    // Pakai axios mentah, bukan `api` — hindari loop interceptor
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    })
    const { token, refresh_token: nextRefresh, user } = res.data
    if (!token) return null
    localStorage.setItem('token', token)
    if (nextRefresh) localStorage.setItem('refresh_token', nextRefresh)
    if (user) {
      const cur = localStorage.getItem('user')
      if (cur) {
        try {
          const merged = { ...JSON.parse(cur), ...user }
          localStorage.setItem('user', JSON.stringify(merged))
        } catch { /* user lama tidak valid, biarkan */ }
      }
    }
    return token
  } catch {
    // Refresh ditolak (kedaluwarsa/reuse) -> sesi benar-benar habis
    clearSession()
    return null
  }
}

// Handle responses
api.interceptors.response.use((response) => {
  return response
}, async (error) => {
  const config = error.config
  const isAuthRoute = config?.url?.includes('/auth/login')
    || config?.url?.includes('/auth/refresh')
    || config?.url?.includes('/auth/logout')
    || config?.url?.includes('/auth/forgot-password')
    || config?.url?.includes('/auth/verify-otp')

  const is401 = error.response?.status === 401

  if (is401 && config && !config._retried && !isAuthRoute) {
    config._retried = true
    if (!refreshing) {
      refreshing = refreshSession().finally(() => { refreshing = null })
    }
    const newToken = await refreshing
    if (newToken) {
      config.headers.Authorization = `Bearer ${newToken}`
      return api(config) // ulangi request asli dengan token baru
    }
    // Refresh gagal: logout paksa tanpa loop reload
    clearSession()
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login')
    }
  } else if (is401 && isAuthRoute && !config?.url?.includes('/auth/login')) {
    // refresh/logout ditolak server -> bersihkan sesi lokal
    clearSession()
  }

  return Promise.reject(error)
})

export default api
