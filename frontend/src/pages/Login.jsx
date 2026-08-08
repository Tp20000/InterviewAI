import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"

const Login = () => {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError("All fields required"); return }
    setLoading(true); setError("")
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}! 👋`)
      if (user.role === "admin")     navigate("/admin")
      else if (user.role === "company") navigate("/company")
      else navigate("/candidate")
    } catch (err) {
      const msg = err.response?.data?.error || "Invalid credentials"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  const fillDemo = (role) => {
    const demos = {
      admin:     { email: "admin@interviewai.com", password: "admin123" },
      company:   { email: "company@demo.com",      password: "demo123" },
      candidate: { email: "candidate@demo.com",    password: "demo123" }
    }
    setForm(demos[role] || demos.admin)
    setError("")
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 border-r border-slate-800">
        <div className="max-w-md">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-8 shadow-xl shadow-blue-500/30">
            AI
          </div>
          <h2 className="text-4xl font-black text-white mb-4">
            AI-Powered Interviews
          </h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            The future of hiring is here. Let AI conduct fair, bias-free interviews
            and give you ranked results instantly.
          </p>
          <div className="space-y-4">
            {[
              { icon: "🤖", text: "AI interviews every candidate the same way" },
              { icon: "⚡", text: "Results in minutes, not days" },
              { icon: "🛡️", text: "Built-in anti-cheat monitoring" },
              { icon: "📊", text: "Detailed scoring and analysis" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto mb-5 shadow-lg shadow-blue-500/25 lg:hidden">
              AI
            </div>
            <h1 className="text-3xl font-black text-white">Welcome Back</h1>
            <p className="text-slate-400 mt-2">Sign in to your InterviewAI account</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
            {error && (
              <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Email Address
                </label>
                <input type="email" placeholder="you@example.com"
                  className="input-field h-12"
                  value={form.email}
                  onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError("") }}
                  autoComplete="email" autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Password
                </label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} placeholder="Enter password"
                    className="input-field h-12 pr-12"
                    value={form.password}
                    onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setError("") }}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                ) : "Sign In →"}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-slate-500 text-xs">Demo Accounts</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { role: "admin",     label: "Admin",    color: "border-purple-700 text-purple-300 hover:bg-purple-900/30" },
                  { role: "company",   label: "Company",  color: "border-blue-700 text-blue-300 hover:bg-blue-900/30" },
                  { role: "candidate", label: "Candidate",color: "border-green-700 text-green-300 hover:bg-green-900/30" }
                ].map(d => (
                  <button key={d.role} onClick={() => fillDemo(d.role)}
                    className={`border rounded-xl py-2 text-xs font-medium transition-all ${d.color}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-slate-400 text-sm mt-6">
              No account?{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Create one free →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
export default Login