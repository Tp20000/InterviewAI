import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import ProtectedRoute    from "./components/common/ProtectedRoute"
import Navbar            from "./components/common/Navbar"

import Landing            from "./pages/Landing"
import Login              from "./pages/Login"
import Register           from "./pages/Register"
import CompanyDashboard   from "./pages/CompanyDashboard"
import CompanyCandidates  from "./pages/CompanyCandidates"
import CandidateDashboard from "./pages/CandidateDashboard"
import AdminDashboard     from "./pages/AdminDashboard"
import InterviewRoom      from "./pages/InterviewRoom"
import InterviewSetup     from "./pages/InterviewSetup"
import Results            from "./pages/Results"
import MockInterview      from "./pages/MockInterview"
import Report             from "./pages/Report"

const DashboardRedirect = () => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === "company")   return <Navigate to="/company"   replace />
  if (user.role === "admin")     return <Navigate to="/admin"     replace />
  return <Navigate to="/candidate" replace />
}

const App = () => {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />

        {/* Company */}
        <Route path="/company" element={
          <ProtectedRoute allowedRoles={["company"]}>
            <CompanyDashboard />
          </ProtectedRoute>
        }/>
        <Route path="/company/setup" element={
          <ProtectedRoute allowedRoles={["company"]}>
            <InterviewSetup />
          </ProtectedRoute>
        }/>
        <Route path="/company/setup/:id" element={
          <ProtectedRoute allowedRoles={["company"]}>
            <InterviewSetup />
          </ProtectedRoute>
        }/>
        <Route path="/company/interview/:id/candidates" element={
          <ProtectedRoute allowedRoles={["company"]}>
            <CompanyCandidates />
          </ProtectedRoute>
        }/>

        {/* Candidate */}
        <Route path="/candidate" element={
          <ProtectedRoute allowedRoles={["candidate"]}>
            <CandidateDashboard />
          </ProtectedRoute>
        }/>
        <Route path="/mock" element={
          <ProtectedRoute allowedRoles={["candidate"]}>
            <MockInterview />
          </ProtectedRoute>
        }/>

        {/* Interview Room - no Navbar */}
        <Route path="/interview/:token" element={
          <ProtectedRoute allowedRoles={["candidate"]}>
            <InterviewRoom />
          </ProtectedRoute>
        }/>

        {/* Results & Reports - accessible by candidate + company + admin */}
        <Route path="/results/:sessionId" element={
          <ProtectedRoute>
            <Results />
          </ProtectedRoute>
        }/>
        <Route path="/report/:sessionId" element={
          <ProtectedRoute>
            <Report />
          </ProtectedRoute>
        }/>

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }/>

        {/* Error pages */}
        <Route path="/unauthorized" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center card max-w-md">
              <div className="text-6xl font-black text-red-400 mb-4">403</div>
              <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
              <p className="text-slate-400 mb-6">
                You don&apos;t have permission to view this page.
              </p>
              <button onClick={() => window.history.back()}
                className="btn-secondary">Go Back</button>
            </div>
          </div>
        }/>
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center card max-w-md">
              <div className="text-6xl font-black text-slate-500 mb-4">404</div>
              <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
              <p className="text-slate-400 mb-6">This page does not exist.</p>
              <button onClick={() => window.history.back()}
                className="btn-secondary">Go Back</button>
            </div>
          </div>
        }/>
      </Routes>
    </div>
  )
}
export default App