import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { interviewService } from "../services/interviewService"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"
import { io } from "socket.io-client"
import { SOCKET_URL } from "../services/api"
import { formatDate, calculateGrade, getGradeColor } from "../utils/helpers"

const GradeBadge = ({ score }) => {
  if (score == null) return null
  const g   = calculateGrade(score)
  const cls = g.startsWith("A") ? "text-green-400 bg-green-900/30 border-green-800"
    : g.startsWith("B") ? "text-blue-400 bg-blue-900/30 border-blue-800"
    : g === "C" ? "text-yellow-400 bg-yellow-900/30 border-yellow-800"
    : "text-red-400 bg-red-900/30 border-red-800"
  return (
    <span className={"text-base font-black px-2.5 py-1 rounded-xl border " + cls}>{g}</span>
  )
}

const StatusDot = ({ status }) => {
  const color = status === "in_progress" ? "bg-red-500 animate-pulse"
    : status === "scheduled"  ? "bg-yellow-500"
    : status === "completed"  ? "bg-green-500"
    : status === "disqualified" ? "bg-red-700"
    : "bg-slate-500"
  return <span className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + color} />
}

const CandidateDashboard = () => {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const sockRef   = useRef(null)

  const [loading,    setLoading]    = useState(true)
  const [stats,      setStats]      = useState({})
  const [interviews, setInterviews] = useState([])
  const [tab,        setTab]        = useState("all")

  useEffect(() => {
    loadData()
    setupSocket()
    return () => { if (sockRef.current) sockRef.current.disconnect() }
  }, [])

  const setupSocket = () => {
    const jwt = localStorage.getItem("access_token")
    if (!jwt) return
    const sock = io(SOCKET_URL, {
      auth: { token: jwt }, transports: ["websocket"], reconnection: true
    })
    sock.on("connect", () => {
      sock.emit("join_user_room", { token: jwt })
    })
    sock.on("new_invitation", (data) => {
      toast.success(
        "🎉 New Interview Invitation!\n" +
        (data.interview_title || "Interview") + " at " + (data.company_name || "Company"),
        { duration: 6000 }
      )
      loadData()
    })
    sock.on("interview_update", () => loadData())
    sockRef.current = sock
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [dRes, iRes] = await Promise.all([
        interviewService.getCandidateDashboard(),
        interviewService.getMyInterviews()
      ])
      setStats(dRes.data.stats || {})
      setInterviews(iRes.data.interviews || [])
    } catch (e) {
      const msg = e.isNetworkError
        ? "Backend not running. Start it with: cd backend && python run.py"
        : (e.response?.data?.error || e.message)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const upcoming  = interviews.filter(i => i.status === "scheduled")
  const active    = interviews.filter(i => i.status === "in_progress")
  const completed = interviews.filter(i => i.status === "completed")
  const other     = interviews.filter(i =>
    !["scheduled", "in_progress", "completed"].includes(i.status)
  )

  const tabs = {
    all:       interviews,
    upcoming:  [...active, ...upcoming],
    completed: completed,
    other:     other
  }
  const display = tabs[tab] || []

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <LoadingSpinner size="lg" text="Loading dashboard..." />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">
              Hi, {(user?.full_name || "").split(" ")[0]}! 👋
            </h1>
            <p className="text-slate-400 mt-1">
              {stats.completed > 0
                ? stats.completed + " interview" + (stats.completed > 1 ? "s" : "") + " completed · Avg: " +
                  (stats.average_score ? stats.average_score.toFixed(1) + "%" : "N/A")
                : "Ready to ace your first interview?"
              }
            </p>
          </div>
          <Link to="/mock" className="btn-primary px-6 py-3 text-sm w-fit">
            <I name="target" size={4} className="text-white" /> Practice Mock Interview
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {[
            { icon: "clipboard", label: "Total",       value: stats.total_interviews || 0, color: "text-blue-400" },
            { icon: "calendar",  label: "Scheduled",   value: stats.scheduled || 0,         color: "text-yellow-400" },
            { icon: "play",      label: "In Progress", value: stats.in_progress || 0,       color: "text-red-400" },
            { icon: "check",     label: "Completed",   value: stats.completed || 0,         color: "text-green-400" },
            { icon: "star",      label: "Avg Score",
              value: stats.average_score ? stats.average_score.toFixed(1) + "%" : "N/A",   color: "text-purple-400" }
          ].map(s => (
            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
              <I name={s.icon} size={5} className={"mx-auto mb-2 " + s.color} />
              <div className={"text-2xl font-black " + s.color}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Interview list */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {[
              { key: "all",       label: "All",       count: interviews.length },
              { key: "upcoming",  label: "Upcoming",  count: upcoming.length + active.length },
              { key: "completed", label: "Completed", count: completed.length },
              { key: "other",     label: "Other",     count: other.length }
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={"flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all " + (
                  tab === t.key ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
                )}>
                {t.label}
                <span className={"text-xs px-1.5 py-0.5 rounded-full " + (tab === t.key ? "bg-white/20" : "bg-slate-700")}>
                  {t.count}
                </span>
              </button>
            ))}
            <button onClick={loadData} className="ml-auto btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
              <I name="refresh" size={3} /> Refresh
            </button>
          </div>

          {display.length === 0 ? (
            <div className="text-center py-16">
              <I name={tab === "upcoming" ? "calendar" : tab === "completed" ? "check" : "clipboard"}
                size={12} className="text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {tab === "upcoming"  ? "No upcoming interviews"
                 : tab === "completed" ? "No completed interviews yet"
                 : "Nothing here yet"}
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                {tab === "upcoming"
                  ? "A company will invite you. Try mock practice while you wait!"
                  : "Complete interviews to see your results here."}
              </p>
              {tab !== "completed" && (
                <Link to="/mock" className="btn-primary px-6">Try Mock Interview</Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {display.map((iv, i) => (
                <div key={i}
                  className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors group">
                  <StatusDot status={iv.status} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-semibold truncate">
                        {iv.interview?.title || "Interview"}
                      </h3>
                      {iv.is_mock && (
                        <span className="badge-purple text-xs">Mock</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <I name="target" size={3} /> {iv.interview?.role_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <I name="chart" size={3} capitalize /> {iv.interview?.experience_level}
                      </span>
                      <span className="flex items-center gap-1">
                        <I name="clock" size={3} /> {iv.interview?.duration_minutes}min
                      </span>
                      <span className="flex items-center gap-1">
                        <I name="question" size={3} /> {iv.interview?.total_questions} Q
                      </span>
                      {iv.ended_at && (
                        <span className="flex items-center gap-1">
                          <I name="calendar" size={3} /> {formatDate(iv.ended_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {iv.status === "completed" && iv.total_score != null && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-white font-bold">{iv.total_score.toFixed(1)}%</div>
                        <div className="text-slate-500 text-xs">Score</div>
                      </div>
                      <GradeBadge score={iv.total_score} />
                    </div>
                  )}

                  <div className="flex-shrink-0">
                    {iv.status === "scheduled" && (
                      <button
                        onClick={() => navigate("/interview/" + iv.session_token)}
                        className="btn-primary text-sm py-2 px-4"
                      >
                        Start
                      </button>
                    )}
                    {iv.status === "in_progress" && (
                      <button
                        onClick={() => navigate("/interview/" + iv.session_token)}
                        className="bg-red-600 hover:bg-red-500 text-white text-sm py-2 px-4 rounded-xl font-semibold animate-pulse"
                      >
                        Resume
                      </button>
                    )}
                    {iv.status === "completed" && (
                      <button
                        onClick={() => navigate("/results/" + iv.session_id)}
                        className="btn-secondary text-sm py-2 px-4"
                      >
                        Results
                      </button>
                    )}
                    {iv.status === "disqualified" && (
                      <span className="badge-red text-xs">Disqualified</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips for new users */}
        {interviews.length === 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: "target",  title: "Practice First",  desc: "Try a mock interview to get comfortable with the AI interview format." },
              { icon: "mic",     title: "Use Voice Input", desc: "Speak your answers naturally. The AI understands speech clearly." },
              { icon: "eye",     title: "Stay Visible",    desc: "Keep your face in the camera. The system monitors for violations." }
            ].map((tip, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <I name={tip.icon} size={6} className="text-blue-400 mb-3" />
                <h3 className="text-white font-bold mb-1">{tip.title}</h3>
                <p className="text-slate-400 text-sm">{tip.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
export default CandidateDashboard