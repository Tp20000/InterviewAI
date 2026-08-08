import { createContext, useContext, useState, useEffect, useCallback } from "react"
import api from "../services/api"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Restore session from localStorage ──────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem("access_token")
    const storedUser  = localStorage.getItem("user")
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setToken(storedToken)
        setUser(parsedUser)
      } catch {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user")
      }
    }
    setLoading(false)
  }, [])

  // ── Login ───────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem("access_token", access_token)
    localStorage.setItem("user",         JSON.stringify(userData))
    setToken(access_token)
    setUser(userData)
    return userData
  }, [])

  // ── Logout ──────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
    setToken(null)
    setUser(null)
    // Stop any active camera
    try {
      if (typeof window.__stopInterviewCamera === "function") {
        window.__stopInterviewCamera()
      }
      document.querySelectorAll("video, audio").forEach(el => {
        try {
          if (el.srcObject) {
            el.srcObject.getTracks().forEach(t => t.stop())
            el.srcObject = null
          }
        } catch(e) {}
      })
    } catch(e) {}
  }, [])

  // ── Register ────────────────────────────────────────────
  const register = useCallback(async (data) => {
    const res = await api.post("/auth/register", data)
    return res.data
  }, [])

  // ── Update user in state + localStorage ─────────────────
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates }
      localStorage.setItem("user", JSON.stringify(updated))
      return updated
    })
  }, [])

  // ── Refresh user from server ────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me")
      const userData = res.data.user
      localStorage.setItem("user", JSON.stringify(userData))
      setUser(userData)
      return userData
    } catch(e) {
      return null
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, register,
      updateUser, refreshUser,
      isAuthenticated: !!user,
      isAdmin:     user?.role === "admin",
      isCompany:   user?.role === "company",
      isCandidate: user?.role === "candidate"
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export default AuthContext