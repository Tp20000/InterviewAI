import axios from "axios"

// ── Backend URL Detection ────────────────────────────────────
function getBackendUrl() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.length > 5) {
    return envUrl.replace(/\/$/, "")
  }
  if (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") {
    return "http://localhost:5000"
  }
  // Hardcoded production fallback
  return "https://interviewai-backend-0vs9.onrender.com"
}

export const BACKEND_URL = getBackendUrl()
export const SOCKET_URL  = BACKEND_URL

console.log("[API] Backend:", BACKEND_URL)

// ── Default API (30s timeout) ────────────────────────────────
const api = axios.create({
  baseURL:         BACKEND_URL + "/api",
  timeout:         30000,
  headers:         { "Content-Type": "application/json" },
  withCredentials: false
})

// ── AI API (120s timeout for Groq calls) ─────────────────────
export const aiApi = axios.create({
  baseURL:         BACKEND_URL + "/api",
  timeout:         120000,   // 2 minutes for AI
  headers:         { "Content-Type": "application/json" },
  withCredentials: false
})

// ── Add JWT to both instances ────────────────────────────────
function addAuthHeader(config) {
  const token = localStorage.getItem("access_token")
  if (token) config.headers.Authorization = "Bearer " + token
  return config
}

api.interceptors.request.use(addAuthHeader, e => Promise.reject(e))
aiApi.interceptors.request.use(addAuthHeader, e => Promise.reject(e))

// ── Error handler factory ────────────────────────────────────
function makeErrorHandler(instanceName) {
  return (error) => {
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        console.error("[" + instanceName + "] Request timed out")
        const timeoutErr = new Error(
          "Request timed out. The AI is warming up, please try again in 30 seconds."
        )
        timeoutErr.isTimeout = true
        return Promise.reject(timeoutErr)
      }
      console.error("[" + instanceName + "] Network error")
      const networkErr = new Error("Cannot connect to server.")
      networkErr.isNetworkError = true
      return Promise.reject(networkErr)
    }

    if (error.response?.status === 401) {
      const path = window.location.pathname
      if (!path.includes("/login") && !path.includes("/register")) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user")
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  }
}

api.interceptors.response.use(r => r, makeErrorHandler("API"))
aiApi.interceptors.response.use(r => r, makeErrorHandler("AI-API"))

export default api