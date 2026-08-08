import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { interviewService } from "../services/interviewService"
import LoadingSpinner from "../components/common/LoadingSpinner"
import I from "../components/common/Icon"
import toast from "react-hot-toast"
import { formatDate, getStatusColor } from "../utils/helpers"

const Stat = ({ icon, label, value, color }) => {
  const bgMap = {
    blue:   "bg-blue-900/20 border-blue-800/40",
    green:  "bg-green-900/20 border-green-800/40",
    purple: "bg-purple-900/20 border-purple-800/40",
    yellow: "bg-yellow-900/20 border-yellow-800/40",
    red:    "bg-red-900/20 border-red-800/40"
  }
  const tcMap = {
    blue: "text-blue-400", green: "text-green-400", purple: "text-purple-400",
    yellow: "text-yellow-400", red: "text-red-400"
  }
  return (
    <div className={"border rounded-2xl p-5 " + (bgMap[color] || bgMap.blue)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        <I name={icon} className={tcMap[color] || "text-slate-400"} />
      </div>
      <div className="text-3xl font-black text-white">{value != null ? value : 0}</div>
    </div>
  )
}

function getRoleBadgeClass(role) {
  if (role === "admin")     return "bg-purple-900/50 text-purple-300 border border-purple-800"
  if (role === "company")   return "bg-blue-900/50 text-blue-300 border border-blue-800"
  return "bg-green-900/50 text-green-300 border border-green-800"
}

function getActiveClass(isActive) {
  return isActive ? "text-green-400" : "text-red-400"
}

function getDotClass(isActive) {
  return isActive ? "bg-green-400" : "bg-red-400"
}

const AdminDashboard = () => {
  const { user } = useAuth()
  const [loading, setLoading]       = useState(true)
  const [stats, setStats]           = useState({})
  const [users, setUsers]           = useState([])
  const [interviews, setInterviews] = useState([])
  const [tab, setTab]               = useState("overview")
  const [roleFilter, setRoleFilter] = useState("")
  const [search, setSearch]         = useState("")
  const [toggling, setToggling]     = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sR, uR, iR] = await Promise.all([
        interviewService.getAdminStats(),
        interviewService.getAdminUsers(),
        interviewService.getAdminInterviews()
      ])
      setStats(sR.data.stats || {})
      setUsers(uR.data.users || [])
      setInterviews(iR.data.interviews || [])
    } catch (e) {
      toast.error("Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }

  const toggleUser = async (uid, currentStatus) => {
    try {
      setToggling(uid)
      await interviewService.toggleUserStatus(uid, !currentStatus)
      toast.success("User " + (!currentStatus ? "activated" : "deactivated"))
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, is_active: !currentStatus } : u))
    } catch {
      toast.error("Failed to update user")
    } finally {
      setToggling(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchRole   = !roleFilter || u.role === roleFilter
    const matchSearch = !search
      || u.full_name.toLowerCase().includes(search.toLowerCase())
      || u.email.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const completionRate = stats.total_sessions > 0
    ? ((stats.completed_sessions / stats.total_sessions) * 100).toFixed(0) + "%"
    : "0%"

  const cheatRate = stats.total_sessions > 0
    ? ((stats.cheat_events / stats.total_sessions) * 100).toFixed(1) + "%"
    : "0%"

  const sessionsPerIV = stats.total_interviews > 0
    ? (stats.total_sessions / stats.total_interviews).toFixed(1)
    : "0"

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading admin panel..." />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">Admin Panel</h1>
          <p className="text-slate-400 mt-1">System management - {user && user.full_name}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Stat icon="users"     label="Total Users"   value={stats.total_users}      color="blue" />
          <Stat icon="building"  label="Companies"     value={stats.total_companies}  color="purple" />
          <Stat icon="target"    label="Candidates"    value={stats.total_candidates} color="green" />
          <Stat icon="clipboard" label="Interviews"    value={stats.total_interviews} color="yellow" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat icon="active"    label="Active Now"    value={stats.active_interviews}  color="green" />
          <Stat icon="robot"     label="Sessions"      value={stats.total_sessions}     color="blue" />
          <Stat icon="check"     label="Completed"     value={stats.completed_sessions} color="purple" />
          <Stat icon="warning"   label="Cheat Events"  value={stats.cheat_events}       color="red" />
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {[
            { k: "overview",   l: "Overview",                       i: "chart" },
            { k: "users",      l: "Users (" + users.length + ")",   i: "users" },
            { k: "interviews", l: "Interviews (" + interviews.length + ")", i: "clipboard" }
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={"flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px " + (
                tab === t.k
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-white"
              )}>
              <I name={t.i} size={4} /> {t.l}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-bold text-white mb-4">System Status</h3>
              {["Database", "Groq AI API", "WebSocket", "Backend API"].map(svc => (
                <div key={svc} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl mb-2">
                  <span className="text-slate-300 text-sm">{svc}</span>
                  <span className="text-green-400 text-sm font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Online
                  </span>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 className="text-lg font-bold text-white mb-4">Key Metrics</h3>
              <div className="flex justify-between p-3 bg-slate-700/30 rounded-xl mb-2">
                <span className="text-slate-400 text-sm">Sessions per Interview</span>
                <span className="text-white font-bold">{sessionsPerIV}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-700/30 rounded-xl mb-2">
                <span className="text-slate-400 text-sm">Completion Rate</span>
                <span className="text-white font-bold">{completionRate}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-700/30 rounded-xl mb-2">
                <span className="text-slate-400 text-sm">Cheat Rate</span>
                <span className="text-white font-bold">{cheatRate}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="text"
                placeholder="Search name or email..."
                className="input-field flex-1"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="input-field sm:w-40"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="company">Company</option>
                <option value="candidate">Candidate</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Role</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Joined</th>
                    <th className="text-left p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(u.full_name || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{u.full_name}</p>
                            <p className="text-slate-400 text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={"text-xs px-2.5 py-1 rounded-full font-medium " + getRoleBadgeClass(u.role)}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={"text-sm font-medium flex items-center gap-1.5 w-fit " + getActiveClass(u.is_active)}>
                          <span className={"w-2 h-2 rounded-full " + getDotClass(u.is_active)} />
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-xs">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="p-4">
                        {u.role !== "admin" && (
                          <button
                            onClick={() => toggleUser(u.id, u.is_active)}
                            disabled={toggling === u.id}
                            className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-all " + (
                              u.is_active
                                ? "bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800/50"
                                : "bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-800/50"
                            )}
                          >
                            {toggling === u.id ? "..." : u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-12">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "interviews" && (
          <div className="card">
            {interviews.length === 0 ? (
              <p className="text-slate-400 text-center py-16">No interviews in system</p>
            ) : (
              <div className="space-y-2">
                {interviews.map((iv, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold truncate">{iv.title}</h3>
                        <span className={getStatusColor(iv.status)}>{iv.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <I name="building" size={3} /> {iv.company_name || "N/A"}
                        </span>
                        <span className="flex items-center gap-1">
                          <I name="target" size={3} /> {iv.role_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <I name="users" size={3} /> {iv.session_count || 0} candidates
                        </span>
                        <span className="flex items-center gap-1">
                          <I name="calendar" size={3} /> {formatDate(iv.created_at)}
                        </span>
                      </div>
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
export default AdminDashboard