import axios from "axios"

// Auto-detect backend URL
// Dev:  http://localhost:5000
// Prod: VITE_API_URL env variable set in Vercel dashboard
export const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"
export const SOCKET_URL  = BACKEND_URL

const api = axios.create({
  baseURL: BACKEND_URL + "/api",
  timeout: 60000,
  headers: { "Content-Type": "application/json" }
})

// Add JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token")
    if (token) config.headers.Authorization = "Bearer " + token
    return config
  },
  (error) => Promise.reject(error)
)

// Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const networkErr = new Error(
        "Cannot connect to server. Make sure the backend is running."
      )
      networkErr.isNetworkError = true
      return Promise.reject(networkErr)
    }

    if (error.response?.status === 401) {
      const currentPath = window.location.pathname
      if (!currentPath.includes("/login") && !currentPath.includes("/register")) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user")
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  }
)

export default api