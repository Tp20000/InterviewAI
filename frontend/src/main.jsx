import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import App from "./App.jsx"
import "./index.css"
import { AuthProvider }      from "./context/AuthContext.jsx"
import { InterviewProvider } from "./context/InterviewContext.jsx"
import { SocketProvider }    from "./context/SocketContext.jsx"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <InterviewProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "#1e293b",
                  color:      "#f1f5f9",
                  border:     "1px solid #334155",
                  borderRadius: "12px",
                  fontSize:   "14px"
                },
                success: {
                  iconTheme: { primary: "#22c55e", secondary: "#f1f5f9" },
                  duration: 3000
                },
                error: {
                  iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" },
                  duration: 5000
                },
                duration: 4000
              }}
            />
          </InterviewProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)