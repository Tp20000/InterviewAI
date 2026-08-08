import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { interviewService } from "../services/interviewService"
import LoadingSpinner
import LoadingSkeleton from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"
import { formatDate } from "../utils/helpers"

const STATUS_MAP = {
  draft:         { label: "Draft",    css: "badge-yellow" },
  topics_review: { label: "Review",   css: "badge-blue" },
  approved:      { label: "Approved", css: "badge-green" },
  active:        { label: "Active",   css: "badge-green" },
  completed:     { label: "Done",     css: "badge-blue" }
}

const Stat = ({ icon, label, value, sub, color }) => {
  const bg = {
    blue:   "bg-blue-900/20 border-blue-800/40",
    green:  "bg-green-900/20 border-green-800/40",
    purple: "bg-purple-900/20 border-purple-800/40",
    yellow: "bg-yellow-900/20 border-yellow-800/40"
  }
  return (
    <div className={"border rounded-2xl p-5 " + (bg[color] || bg.blue)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm">{label}</span>
        <I name={icon} className="text-slate-500" />
      </div>
      <div className="text-3xl font-black text-white">{value ?? 0}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

const CompanyDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading,    setLoading]    = useState(true)
  const [stats,      setStats]      = useState({})
  const [interviews, setInterviews] = useState([])
  const [company,    setCompany]    = useState(null)
  const [filter,     setFilter]     = useState("all")
  const [deleteId,   setDeleteId]   = useState(null)
  const [deleting,   setDeleting]   = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [dRes, iRes] = await Promise.all([
        interviewService.getDashboard(),
        interviewService.getInterviews()
      ])
      setStats(dRes.data.stats || {})
      setCompany(dRes.data.company)
      setInterviews(iRes.data.interviews || [])
    } catch (e) {
      const msg = e.isNetworkError
        ? "Backend not running. Start: cd backend && python run.py"
        : (e.response?.data?.error || e.message)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await interviewService.deleteInterview(deleteId)
      toast.success("Interview deleted")
      setDeleteId(null)
      loadData()
    } catch (e) {
      toast.error(e.response?.data?.error || "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const filtered = filter === "all"
    ? interviews
    : interviews.filter(iv => iv.status === filter)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <LoadingSpinner size="lg" text="Loading dashboard..." />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">
              {company?.company_name || "Company"} Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Welcome back, {user?.full_name}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="btn-secondary text-sm">
              <I name="refresh" size={4} /> Refresh
            </button>
            <Link to="/company/setup" className="btn-primary px-6 py-3 text-sm">
              <I name="plus" className="text-white" /> New Interview
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat icon="clipboard" label="Total Interviews"   value={stats.total_interviews}     color="blue"   sub="All time" />
          <Stat icon="active"    label="Active Now"         value={stats.active_interviews}    color="green"  sub="Running" />
          <Stat icon="users"     label="Total Candidates"   value={stats.total_candidates}     color="purple" sub="Across all" />
          <Stat icon="check"     label="Completed Sessions" value={stats.completed_interviews} color="yellow" sub="Finished" />
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h2 className="text-xl font-bold text-white">Your Interviews</h2>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "draft", "active", "completed"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-all capitalize " + (
                    filter === f
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  )}>
                  {f === "all" ? "All (" + interviews.length + ")" : f}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <I name="clipboard" className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {filter === "all" ? "No interviews yet" : "No " + filter + " interviews"}
              </h3>
              <p className="text-slate-400 mb-6">
                {filter === "all"
                  ? "Create your first AI-powered interview to get started"
                  : "Try a different filter"}
              </p>
              {filter === "all" && (
                <Link to="/company/setup" className="btn-primary">Create Interview</Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((iv, i) => {
                const st = STATUS_MAP[iv.status] || { label: iv.status, css: "badge-blue" }
                return (
                  <div key={i}
                    className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors group">
                    <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <I name={iv.status === "active" ? "active" : iv.status === "draft" ? "pencil" : "clipboard"}
                        className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold truncate">{iv.title}</h3>
                        <span className={st.css}>{st.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><I name="target" className="w-3 h-3" /> {iv.role_name}</span>
                        <span className="flex items-center gap-1"><I name="chart" className="w-3 h-3" /> {iv.experience_level}</span>
                        <span className="flex items-center gap-1"><I name="clock" className="w-3 h-3" /> {iv.duration_minutes}min</span>
                        <span className="flex items-center gap-1"><I name="question" className="w-3 h-3" /> {iv.total_questions} Q</span>
                        <span className="flex items-center gap-1"><I name="users" className="w-3 h-3" /> {iv.candidate_count || 0} candidates</span>
                        <span className="flex items-center gap-1"><I name="calendar" className="w-3 h-3" /> {formatDate(iv.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {iv.status === "active" && (
                        <button onClick={() => navigate("/company/interview/" + iv.id + "/candidates")}
                          className="bg-green-900/50 hover:bg-green-900 border border-green-700 text-green-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                          Candidates
                        </button>
                      )}
                      <button onClick={() => navigate("/company/setup/" + iv.id)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-all">
                        {iv.status === "draft" ? "Edit" : "View"}
                      </button>
                      {iv.status === "draft" && (
                        <button onClick={() => setDeleteId(iv.id)}
                          className="bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 text-xs px-3 py-1.5 rounded-lg transition-all">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card w-full max-w-sm text-center animate-fade-in">
            <I name="trash" className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Delete Interview?</h3>
            <p className="text-slate-400 text-sm mb-6">
              This action cannot be undone. The interview and all its data will be deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <LoadingSpinner size="sm" text="" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CompanyDashboard