import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { interviewService } from "../services/interviewService"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"

const LEVELS = [
  { value: "fresher", label: "Fresher", desc: "0-1 yr",  icon: "bulb",    color: "border-green-700 hover:border-green-500" },
  { value: "junior",  label: "Junior",  desc: "1-3 yrs", icon: "doc",     color: "border-blue-700 hover:border-blue-500" },
  { value: "mid",     label: "Mid",     desc: "3-5 yrs", icon: "lightning",color: "border-yellow-700 hover:border-yellow-500" },
  { value: "senior",  label: "Senior",  desc: "5+ yrs",  icon: "trophy",  color: "border-purple-700 hover:border-purple-500" }
]

const POPULAR = [
  { role: "Software Engineer",     icon: "robot" },
  { role: "Frontend Developer",    icon: "globe" },
  { role: "Backend Developer",     icon: "cog" },
  { role: "Full Stack Developer",  icon: "lightning" },
  { role: "Data Scientist",        icon: "chart" },
  { role: "ML Engineer",           icon: "robot" },
  { role: "DevOps Engineer",       icon: "rocket" },
  { role: "Product Manager",       icon: "clipboard" },
  { role: "UI/UX Designer",        icon: "pencil" },
  { role: "QA Engineer",           icon: "search" },
  { role: "Data Analyst",          icon: "chart" },
  { role: "Cloud Architect",       icon: "globe" }
]

const MockInterview = () => {
  const navigate = useNavigate()
  const [loading, setLoading]     = useState(false)
  const [role, setRole]           = useState("")
  const [customRole, setCustomRole] = useState("")
  const [level, setLevel]         = useState("mid")
  const [resumeText, setResumeText] = useState("")
  const [showResume, setShowResume] = useState(false)

  const finalRole = role === "__custom__" ? customRole.trim() : role

  const handleUploadResume = async () => {
    if (!resumeText || resumeText.length < 30) {
      toast.error("Please paste your full resume (minimum 30 characters)")
      return
    }
    try {
      const api = (await import("../services/api")).default
      await api.post("/auth/upload-resume", { resume_text: resumeText })
      toast.success("Resume uploaded! AI will ask questions from it.")
      setShowResume(false)
    } catch (e) {
      toast.error(e.response?.data?.error || "Upload failed")
    }
  }

  const handleStart = async () => {
    if (!finalRole) { toast.error("Please select a role"); return }
    try {
      setLoading(true)
      const res = await interviewService.startMock({
        role_name: finalRole,
        experience_level: level
      })
      toast.success("Mock interview created! Get ready...")
      setTimeout(() => navigate("/interview/" + res.data.session_token), 1000)
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to start")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-16">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/candidate")}
            className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
            <I name="home" size={4} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white">Mock Interview</h1>
            <p className="text-slate-400 mt-0.5">Practice with AI - No pressure - Instant feedback</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-blue-900/20 border border-blue-800/40 rounded-2xl p-5 mb-8 flex items-start gap-4">
          <I name="bulb" className="text-blue-400 flex-shrink-0 mt-0.5" size={6} />
          <div>
            <p className="text-blue-300 font-bold mb-1">How Mock Interviews Work</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Practice with Alex, our AI interviewer. Get real technical questions,
              behavioral questions, and receive detailed feedback on every answer.
              Upload your resume for personalized questions!
            </p>
          </div>
        </div>

        {/* Resume upload section */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <I name="doc" className="text-purple-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Upload Resume (Optional)</h2>
                <p className="text-slate-400 text-xs">AI will ask questions based on your resume</p>
              </div>
            </div>
            <button onClick={() => setShowResume(p => !p)}
              className="btn-secondary text-xs py-1.5 px-3">
              {showResume ? "Hide" : "Upload Resume"}
            </button>
          </div>

          {showResume && (
            <div className="mt-4 space-y-3">
              <textarea
                rows={8}
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                placeholder="Paste your full resume text here... Include: skills, experience, projects, education..."
                className="input-field resize-none text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">{resumeText.length} characters</span>
                <button onClick={handleUploadResume} disabled={resumeText.length < 30}
                  className="btn-primary text-sm py-2 px-6">
                  <I name="check" size={4} className="text-white" /> Save Resume
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Role selection */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-5">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <I name="target" className="text-blue-400" /> Select Role
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            {POPULAR.map(p => (
              <button key={p.role} onClick={() => setRole(p.role)}
                className={"flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all text-left " + (
                  role === p.role
                    ? "border-blue-500 bg-blue-900/30 text-blue-300"
                    : "border-slate-700 bg-slate-700/20 text-slate-400 hover:border-slate-500 hover:text-white"
                )}>
                <I name={p.icon} size={4} className="flex-shrink-0" />
                <span className="truncate">{p.role}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setRole("__custom__")}
            className={"w-full flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all " + (
              role === "__custom__"
                ? "border-purple-500 bg-purple-900/30 text-purple-300"
                : "border-slate-700 bg-slate-700/20 text-slate-400 hover:border-slate-500 hover:text-white"
            )}>
            <I name="pencil" size={4} /> Custom Role...
          </button>
          {role === "__custom__" && (
            <input type="text" placeholder="Enter role name (e.g. Android Developer)"
              className="input-field mt-2" value={customRole}
              onChange={e => setCustomRole(e.target.value)} autoFocus />
          )}
        </div>

        {/* Level selection */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-5">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <I name="chart" className="text-yellow-400" /> Experience Level
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LEVELS.map(l => (
              <button key={l.value} onClick={() => setLevel(l.value)}
                className={"p-4 rounded-xl border-2 text-center transition-all " + (
                  level === l.value
                    ? l.color + " bg-slate-700/50"
                    : "border-slate-700 bg-slate-700/20 hover:border-slate-600"
                )}>
                <I name={l.icon} size={6} className="mx-auto mb-2 text-slate-400" />
                <p className="text-white font-bold text-sm">{l.label}</p>
                <p className="text-slate-400 text-xs">{l.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Summary + Start */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <I name="rocket" className="text-green-400" /> Ready?
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: "target",   label: "Role",      value: finalRole || "Not selected" },
              { icon: "chart",    label: "Level",     value: level },
              { icon: "question", label: "Questions", value: "8 questions" }
            ].map(s => (
              <div key={s.label} className="bg-slate-700/40 rounded-xl p-3 text-center">
                <I name={s.icon} size={4} className="mx-auto mb-1 text-slate-500" />
                <p className="text-slate-400 text-xs mb-1">{s.label}</p>
                <p className="text-white text-xs font-semibold capitalize truncate">{s.value}</p>
              </div>
            ))}
          </div>
          <button onClick={handleStart} disabled={!finalRole || loading}
            className="btn-primary w-full py-4 text-base">
            {loading
              ? <><LoadingSpinner size="sm" text="" /> Creating interview...</>
              : <><I name="rocket" size={5} className="text-white" /> Start Mock Interview</>
            }
          </button>
          <p className="text-slate-500 text-xs text-center mt-3">
            Mock results are private and for practice only
          </p>
        </div>
      </div>
    </div>
  )
}
export default MockInterview