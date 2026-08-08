import axios from "axios"

// ── Backend URL Detection ────────────────────────────────────
// Priority:
// 1. VITE_API_URL env var (set in Vercel dashboard)
// 2. Window location based detection
// 3. Fallback to localhost for dev

function getBackendUrl() {
  // Check Vite env variable (set in Vercel)
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.length > 5) {
    console.log("[API] Using VITE_API_URL:", envUrl)
    return envUrl.replace(/\/$/, "") // remove trailing slash
  }

  // If running on localhost - use local backend
  if (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") {
    console.log("[API] Using localhost backend")
    return "http://localhost:5000"
  }

  // Production fallback - hardcoded render URL
  const prodUrl = "https://interviewai-backend-0vs9.onrender.com"
  console.log("[API] Using production backend:", prodUrl)
  return prodUrl
}

export const BACKEND_URL = getBackendUrl()
export const SOCKET_URL  = BACKEND_URL

console.log("[API] Backend URL:", BACKEND_URL)
console.log("[API] Socket URL:", SOCKET_URL)

const api = axios.create({
  baseURL: BACKEND_URL + "/api",
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
  withCredentials: false
})

// ── Add JWT token to every request ──────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token")
    if (token) {
      config.headers.Authorization = "Bearer " + token
    }
    console.log("[API]", config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => Promise.reject(error)
)

// ── Handle errors globally ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error("[API] Network error - backend unreachable")
      const networkErr = new Error(
        "Cannot connect to server. Backend URL: " + BACKEND_URL
      )
      networkErr.isNetworkError = true
      return Promise.reject(networkErr)
    }

    const status = error.response?.status
    console.error("[API] Error", status, error.response?.data)

    if (status === 401) {
      const currentPath = window.location.pathname
      if (!currentPath.includes("/login") &&
          !currentPath.includes("/register")) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user")
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  }
)

export default api