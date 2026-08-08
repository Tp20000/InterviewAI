import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import I from "./Icon"

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate("/login"); setMenuOpen(false) }

  const dashPath = !user ? "/" : user.role === "company" ? "/company" : user.role === "admin" ? "/admin" : "/candidate"

  // Hide navbar in interview room
  if (location.pathname.startsWith("/interview/")) return null

  const initials = (user?.full_name || "").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  const navLinks = user?.role === "company" ? [
    { to: "/company", label: "Dashboard", icon: "chart" },
    { to: "/company/setup", label: "New Interview", icon: "plus" }
  ] : user?.role === "candidate" ? [
    { to: "/candidate", label: "Dashboard", icon: "chart" },
    { to: "/mock", label: "Practice", icon: "target" }
  ] : user?.role === "admin" ? [
    { to: "/admin", label: "Admin Panel", icon: "cog" }
  ] : []

  return (
    <nav className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          <Link to={dashPath} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/25">AI</div>
            <span className="text-white font-black text-xl tracking-tight">InterviewAI</span>
          </Link>

          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to}
                  className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all " + (
                    location.pathname === link.to
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}>
                  <I name={link.icon} size={4} /> {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(p => !p)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-800 transition-all">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                  <span className="text-white text-sm font-medium hidden md:block max-w-32 truncate">{user.full_name}</span>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-700">
                        <p className="text-white font-semibold text-sm truncate">{user.full_name}</p>
                        <p className="text-slate-400 text-xs truncate">{user.email}</p>
                        <span className={"inline-block mt-1 text-xs px-2 py-0.5 rounded-full " + (
                          user.role === "admin" ? "bg-purple-900/50 text-purple-300"
                          : user.role === "company" ? "bg-blue-900/50 text-blue-300"
                          : "bg-green-900/50 text-green-300"
                        )}>{user.role}</span>
                      </div>
                      <div className="py-2">
                        <Link to={dashPath} onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700 text-sm">
                          <I name="chart" size={4} /> Dashboard
                        </Link>
                        {user.role === "candidate" && (
                          <Link to="/mock" onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700 text-sm">
                            <I name="target" size={4} /> Mock Practice
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-slate-700 py-2">
                        <button onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 text-sm">
                          <I name="logout" size={4} /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-800">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm px-5 py-2">Get Started</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
export default Navbar