import { useState, useEffect } from "react"
import { BACKEND_URL } from "../services/api"
import api, { aiApi } from "../services/api"

const Debug = () => {
  const [results, setResults]  = useState([])
  const [testing, setTesting]  = useState(false)
  const [autoInfo, setAutoInfo] = useState({})

  useEffect(() => {
    setAutoInfo({
      hostname:    window.location.hostname,
      backendUrl:  BACKEND_URL,
      hasToken:    !!localStorage.getItem("access_token"),
      tokenPart:   (localStorage.getItem("access_token") || "").substring(0,30),
      user:        localStorage.getItem("user"),
      viteApiUrl:  import.meta.env.VITE_API_URL,
      mode:        import.meta.env.MODE
    })
  }, [])

  const add = (name, status, msg) => {
    setResults(p => [...p, { name, status, msg, time: new Date().toLocaleTimeString() }])
  }

  const runTests = async () => {
    setResults([])
    setTesting(true)

    // Info
    add("Hostname",     "info", window.location.hostname)
    add("Backend URL",  "info", BACKEND_URL)
    add("VITE_API_URL", "info", import.meta.env.VITE_API_URL || "(not set - using hardcoded)")
    add("Build Mode",   "info", import.meta.env.MODE)

    const token = localStorage.getItem("access_token")
    const user  = localStorage.getItem("user")
    add("JWT Token",  token ? "pass" : "fail",
      token ? "✅ Present: " + token.substring(0, 30) + "..." : "❌ MISSING - Login first!")
    add("User Data",  user ? "pass" : "fail",
      user ? "✅ " + user.substring(0, 80) : "❌ No user in localStorage")

    // Health
    try {
      const r = await fetch(BACKEND_URL + "/api/health", { method: "GET" })
      const d = await r.json()
      add("Health Check", r.ok ? "pass" : "fail",
        r.ok ? "✅ " + JSON.stringify(d) : "❌ " + JSON.stringify(d))
    } catch(e) {
      add("Health Check", "fail", "❌ " + e.message)
    }

    // Auth ping
    try {
      const r = await api.get("/auth/ping")
      add("Auth Ping", "pass", "✅ " + JSON.stringify(r.data))
    } catch(e) {
      add("Auth Ping", "fail",
        "❌ " + (e.response?.data?.error || e.message))
    }

    // Company debug (needs token)
    if (token) {
      try {
        const r = await api.get("/company/debug/me")
        add("Company Debug", "pass", "✅ " + JSON.stringify(r.data))
      } catch(e) {
        add("Company Debug", "fail",
          "❌ HTTP " + (e.response?.status || "?") + " - " +
          (e.response?.data?.error || e.message))
      }

      // Company dashboard
      try {
        const r = await api.get("/company/dashboard")
        add("Company Dashboard", "pass",
          "✅ Got stats: " + JSON.stringify(r.data?.stats))
      } catch(e) {
        add("Company Dashboard", "fail",
          "❌ HTTP " + (e.response?.status || "?") + " - " +
          (e.response?.data?.error || e.message))
      }
    } else {
      add("Company Tests", "fail", "❌ Skipped - no token. Please login first!")
    }

    setTesting(false)
  }

  const cls = (s) => ({
    pass: "text-green-300 bg-green-900/20 border-green-700",
    fail: "text-red-300 bg-red-900/20 border-red-700",
    info: "text-blue-300 bg-blue-900/20 border-blue-700"
  }[s] || "text-slate-300 bg-slate-800 border-slate-700")

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Debug Panel</h1>
            <p className="text-slate-400 text-sm">
              Diagnose frontend ↔ backend connection
            </p>
          </div>
          <button onClick={runTests} disabled={testing}
            className="btn-primary">
            {testing ? "Testing..." : "Run Diagnostics"}
          </button>
        </div>

        {/* Auto info */}
        <div className="card mb-6">
          <h2 className="text-white font-semibold mb-3">Environment Info</h2>
          <div className="grid grid-cols-1 gap-2 text-sm font-mono">
            <div className="flex justify-between p-2 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Hostname:</span>
              <span className="text-white">{autoInfo.hostname}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Backend URL:</span>
              <span className="text-green-400">{autoInfo.backendUrl}</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">VITE_API_URL:</span>
              <span className={autoInfo.viteApiUrl ? "text-green-400" : "text-yellow-400"}>
                {autoInfo.viteApiUrl || "(not set - using hardcoded URL above)"}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Has Token:</span>
              <span className={autoInfo.hasToken ? "text-green-400" : "text-red-400"}>
                {autoInfo.hasToken ? "YES" : "NO - Login required"}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Mode:</span>
              <span className="text-white">{autoInfo.mode}</span>
            </div>
          </div>
        </div>

        {/* Test results */}
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={"border rounded-xl p-3 " + cls(r.status)}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{r.name}</span>
                <span className="text-xs opacity-60">{r.time}</span>
              </div>
              <p className="text-xs font-mono break-all opacity-90">{r.msg}</p>
            </div>
          ))}
          {results.length === 0 && !testing && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg mb-2">Ready to diagnose</p>
              <p className="text-sm">Click "Run Diagnostics" to check all connections</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default Debug