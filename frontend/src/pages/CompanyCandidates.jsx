import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { interviewService } from "../services/interviewService"
import CandidateTable from "../components/dashboard/CandidateTable"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"

const CompanyCandidates = () => {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [loading, setLoading]       = useState(true)
  const [interview, setInterview]   = useState(null)
  const [candidates, setCandidates] = useState([])
  const [rankings, setRankings]     = useState([])
  const [tab, setTab]               = useState("candidates")

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [ivRes, cRes] = await Promise.all([
        interviewService.getInterview(id),
        interviewService.getCandidates(id)
      ])
      setInterview(ivRes.data.interview)
      setCandidates(cRes.data.candidates || [])

      // Load rankings if there are completed sessions
      try {
        const rRes = await interviewService.getRankings(id)
        setRankings(rRes.data.rankings || [])
      } catch {}

    } catch {
      toast.error("Failed to load candidates")
    } finally {
      setLoading(false)
    }
  }

  const completed = candidates.filter(c => c.status === "completed")
  const pending   = candidates.filter(c => c.status !== "completed")

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading candidates..." />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/company")}
            className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
            <I name="home" size={4} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{interview?.title || "Interview"}</h1>
            <p className="text-slate-400 text-sm">
              {candidates.length} candidates · {completed.length} completed
            </p>
          </div>
          <button onClick={loadData} className="ml-auto btn-secondary text-xs py-2 px-3">
            <I name="refresh" size={3} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total",      value: candidates.length,                          color: "text-blue-400" },
            { label: "Completed",  value: completed.length,                           color: "text-green-400" },
            { label: "Pending",    value: pending.length,                             color: "text-yellow-400" },
            { label: "Avg Score",  value: completed.length > 0
                ? (completed.reduce((s,c) => s + (c.total_score||0), 0) / completed.length).toFixed(1) + "%"
                : "N/A",                                                              color: "text-purple-400" }
          ].map(s => (
            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
              <div className={"text-2xl font-black " + s.color}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-700">
          {[
            { k: "candidates", l: "All Candidates (" + candidates.length + ")" },
            { k: "rankings",   l: "Rankings (" + rankings.length + ")" }
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={"px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all " + (
                tab === t.k ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-white"
              )}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === "candidates" && (
          <div className="card">
            <CandidateTable
              candidates={candidates}
              onViewReport={(sid) => navigate(`/results/${sid}`)}
            />
          </div>
        )}

        {tab === "rankings" && (
          <div className="card">
            {rankings.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-sm">
                No completed interviews yet. Rankings will appear once candidates finish.
              </p>
            ) : (
              <div className="space-y-2">
                {rankings.map((r, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
                    <div className={"w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg " + (
                      r.rank === 1 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-600/50"
                      : r.rank === 2 ? "bg-slate-500/20 text-slate-300 border border-slate-500/50"
                      : r.rank === 3 ? "bg-orange-700/20 text-orange-400 border border-orange-700/50"
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/50"
                    )}>
                      {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : "#" + r.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{r.candidate_name}</p>
                      <p className="text-slate-400 text-xs">{r.candidate_email}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-white font-bold">{(r.total_score || 0).toFixed(1)}%</p>
                        <p className="text-slate-500 text-xs">Score</p>
                      </div>
                      <div className={"text-xl font-black " + (
                        r.grade?.startsWith("A") ? "text-green-400"
                        : r.grade?.startsWith("B") ? "text-blue-400"
                        : r.grade === "C" ? "text-yellow-400"
                        : "text-red-400"
                      )}>{r.grade}</div>
                      <button onClick={() => navigate(`/results/${r.session_id}`)}
                        className="btn-secondary text-xs py-1.5 px-3">
                        Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
export default CompanyCandidates