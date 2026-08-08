import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import I from "./Icon"

const Sidebar = ({ links = [] }) => {
  const location = useLocation()
  const { user }  = useAuth()

  return (
    <aside className="w-64 min-h-screen bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
            AI
          </div>
          <span className="text-white font-bold">InterviewAI</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link, i) => (
          <Link key={i} to={link.to}
            className={"flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all " + (
              location.pathname === link.to
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            )}>
            <I name={link.icon} size={4} />
            {link.label}
          </Link>
        ))}
      </nav>
      {user && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {(user.full_name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.full_name}</p>
              <p className="text-slate-500 text-xs truncate">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
export default Sidebar