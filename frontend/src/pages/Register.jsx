import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"

const ROLES = [
  {
    value: "candidate",
    label: "Job Candidate",
    desc: "Take AI interviews and practice mock tests",
    icon: "",
    accent: "border-green-600 bg-green-900/20 hover:border-green-500"
  },
  {
    value: "company",
    label: "Company / HR",
    desc: "Post jobs, setup AI interviews, review ranked results",
    icon: "",
    accent: "border-blue-600 bg-blue-900/20 hover:border-blue-500"
  }
]

const INDUSTRIES = [
  "Technology","Finance","Healthcare","Education",
  "E-commerce","Manufacturing","Consulting","Media","Other"
]

const Register = () => {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [errors, setErrors]   = useState({})

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm_pw: "",
    role: "candidate", company_name: "", industry: "", website: ""
  })

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }))
    setErrors(p => ({ ...p, [field]: "", general: "" }))
  }

  const validateStep1 = () => {
    const e = {}
    if (!form.full_name.trim())  e.full_name = "Full name is required"
    if (!form.email.trim())      e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email"
    if (!form.password)          e.password = "Password required"
    else if (form.password.length < 6) e.password = "Min 6 characters"
    if (form.password !== form.confirm_pw) e.confirm_pw = "Passwords do not match"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    if (form.role !== "company") return true
    const e = {}
    if (!form.company_name.trim()) e.company_name = "Company name required"
    if (!form.industry)            e.industry = "Please select industry"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return
    setLoading(true)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email:     form.email.trim().toLowerCase(),
        password:  form.password,
        role:      form.role
      }
      if (form.role === "company") {
        payload.company_name = form.company_name.trim()
        payload.industry     = form.industry
        payload.website      = form.website.trim()
      }
      await register(payload)
      const user = await login(payload.email, payload.password)
      toast.success("Welcome to InterviewAI!")
      navigate(user.role === "company" ? "/company" : "/candidate")
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed"
      setErrors({ general: msg })
      toast.error(msg)
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-900 border-r border-slate-800 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="max-w-sm relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-8 shadow-xl shadow-blue-500/20">AI</div>
          <h2 className="text-4xl font-black text-white mb-4 leading-tight">
            Join the Future<br />of Hiring
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            AI-powered interviews that are fair, fast, and bias-free. Join thousands of companies and candidates.
          </p>
          <div className="space-y-4">
            {[
              { icon: "", text: "AI interviewer conducts real conversations" },
              { icon: "", text: "Instant scores and ranked reports" },
              { icon: "???", text: "Built-in anti-cheat monitoring" },
              { icon: "", text: "Free forever - no credit card needed" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <span className="text-xl">{item.icon}</span>
                <span className="text-slate-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-black text-lg mx-auto mb-4 lg:hidden">AI</div>
            <h1 className="text-3xl font-black text-white">Create Account</h1>
            <p className="text-slate-400 mt-1">Join InterviewAI for free</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            <div className={"flex-1 flex items-center gap-2"}>
              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all " + (step >= 1 ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400")}>
                {step > 1 ? "" : "1"}
              </div>
              <span className={"text-sm " + (step === 1 ? "text-white font-medium" : "text-slate-500")}>
                Basic Info
              </span>
            </div>
            <div className={"flex-1 h-px " + (step > 1 ? "bg-blue-600" : "bg-slate-700")} />
            <div className={"flex items-center gap-2"}>
              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all " + (step >= 2 ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400")}>
                2
              </div>
              <span className={"text-sm " + (step === 2 ? "text-white font-medium" : "text-slate-500")}>
                Account Type
              </span>
            </div>
          </div>

          {/* Card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8">
            {errors.general && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 mb-5 text-sm flex items-center gap-2">
                <span></span>{errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-2">Full Name</label>
                    <input type="text" placeholder="John Doe" className={"input-field h-12 " + (errors.full_name ? "border-red-500" : "")}
                      value={form.full_name} onChange={e => set("full_name", e.target.value)} autoFocus />
                    {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-2">Email Address</label>
                    <input type="email" placeholder="you@example.com" className={"input-field h-12 " + (errors.email ? "border-red-500" : "")}
                      value={form.email} onChange={e => set("email", e.target.value)} />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-2">Password</label>
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} placeholder="Min 6 characters" className={"input-field h-12 pr-12 " + (errors.password ? "border-red-500" : "")}
                        value={form.password} onChange={e => set("password", e.target.value)} />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-medium">
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-2">Confirm Password</label>
                    <input type="password" placeholder="Repeat password" className={"input-field h-12 " + (errors.confirm_pw ? "border-red-500" : "")}
                      value={form.confirm_pw} onChange={e => set("confirm_pw", e.target.value)} />
                    {errors.confirm_pw && <p className="text-red-400 text-xs mt-1">{errors.confirm_pw}</p>}
                  </div>
                  <button type="button" onClick={() => validateStep1() && setStep(2)}
                    className="btn-primary w-full h-12 mt-2">
                    Continue ?
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-3">I am joining as...</label>
                    <div className="space-y-3">
                      {ROLES.map(r => (
                        <button key={r.value} type="button" onClick={() => set("role", r.value)}
                          className={"w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all " + (
                            form.role === r.value ? r.accent : "border-slate-700 hover:border-slate-600 bg-slate-700/20"
                          )}>
                          <span className="text-3xl flex-shrink-0">{r.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold">{r.label}</p>
                            <p className="text-slate-400 text-sm mt-0.5">{r.desc}</p>
                          </div>
                          <div className={"w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 " + (
                            form.role === r.value ? "border-blue-400 bg-blue-600" : "border-slate-600"
                          )}>
                            {form.role === r.value && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Company fields */}
                  {form.role === "company" && (
                    <div className="space-y-3 p-4 bg-blue-900/10 border border-blue-800/30 rounded-xl">
                      <p className="text-blue-300 text-sm font-semibold">Company Details</p>
                      <div>
                        <label className="block text-slate-300 text-xs mb-1.5">Company Name *</label>
                        <input type="text" placeholder="Acme Corp" className={"input-field " + (errors.company_name ? "border-red-500" : "")}
                          value={form.company_name} onChange={e => set("company_name", e.target.value)} />
                        {errors.company_name && <p className="text-red-400 text-xs mt-1">{errors.company_name}</p>}
                      </div>
                      <div>
                        <label className="block text-slate-300 text-xs mb-1.5">Industry *</label>
                        <select className={"input-field " + (errors.industry ? "border-red-500" : "")}
                          value={form.industry} onChange={e => set("industry", e.target.value)}>
                          <option value="">Select industry...</option>
                          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                        {errors.industry && <p className="text-red-400 text-xs mt-1">{errors.industry}</p>}
                      </div>
                      <div>
                        <label className="block text-slate-300 text-xs mb-1.5">Website (optional)</label>
                        <input type="url" placeholder="https://yourcompany.com" className="input-field"
                          value={form.website} onChange={e => set("website", e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 h-12">
                      ? Back
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary flex-1 h-12">
                      {loading ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                      ) : "Create Account"}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="text-center text-slate-400 text-sm mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold">Sign In ?</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
export default Register