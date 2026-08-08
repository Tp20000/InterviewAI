import api from "./api"

export const authService = {

  login: async (email, password) => {
    const res = await api.post("/auth/login", { email, password })
    return res.data
  },

  register: async (data) => {
    const res = await api.post("/auth/register", data)
    return res.data
  },

  logout: async () => {
    try { await api.post("/auth/logout") } catch {}
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
  },

  getMe: async () => {
    const res = await api.get("/auth/me")
    return res.data
  },

  changePassword: async (old_password, new_password) => {
    const res = await api.put("/auth/change-password", { old_password, new_password })
    return res.data
  }

}