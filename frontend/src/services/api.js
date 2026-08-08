import axios from "axios"

// ── Backend URL ──────────────────────────────────────────────
const PROD_URL = "https://interviewai-backend-0vs9.onrender.com"
const DEV_URL  = "http://localhost:5000"

const isLocal = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "0.0.0.0"
)

export const BACKEND_URL = isLocal ? DEV_URL : PROD_URL
export const SOCKET_URL  = BACKEND_URL

console.log("[API] Backend:", BACKEND_URL)

// ── Standard API (45s) ───────────────────────────────────────
const api = axios.create({
  baseURL:         BACKEND_URL + "/api",
  timeout:         45000,
  withCredentials: false,
  headers:         {
    "Content-Type": "application/json",
    "Accept":       "application/json"
  }
})

// ── AI API (180s for Groq calls) ─────────────────────────────
export const aiApi = axios.create({
  baseURL:         BACKEND_URL + "/api",
  timeout:         180000,
  withCredentials: false,
  headers:         {
    "Content-Type": "application/json",
    "Accept":       "application/json"
  }
})

// ── Auth interceptor ─────────────────────────────────────────
function addAuth(config) {
  const token = localStorage.getItem("access_token")
  if (token) {
    config.headers["Authorization"] = "Bearer " + token
  }
  return config
}

api.interceptors.request.use(addAuth, e => Promise.reject(e))
aiApi.interceptors.request.use(addAuth, e => Promise.reject(e))

// ── Error handler ────────────────────────────────────────────
function onError(error) {
  if (!error.response) {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      console.warn("[API] Timeout")
      const e  = new Error("Request timed out. Please try again.")
      e.isTimeout = true
      return Promise.reject(e)
    }
    console.error("[API] Network error. Backend:", BACKEND_URL)
    const e = new Error("Cannot connect to server.")
    e.isNetworkError = true
    return Promise.reject(e)
  }

  const { status, data } = error.response
  console.error("[API] HTTP", status, data)

  if (status === 401) {
    const path = window.location.pathname
    if (!path.includes("/login") && !path.includes("/register")) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("user")
      window.location.href = "/login"
    }
  }

  return Promise.reject(error)
}

api.interceptors.response.use(r => r, onError)
aiApi.interceptors.response.use(r => r, onError)

export default api