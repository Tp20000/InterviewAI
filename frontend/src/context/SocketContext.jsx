import { createContext, useContext, useRef, useState, useEffect } from "react"
import { io } from "socket.io-client"
import { SOCKET_URL, BACKEND_URL } from "../services/api"

const SocketContext = createContext(null)

// Render free tier works better with polling
const isLocal = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
)

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  const connect = (token) => {
    if (socketRef.current?.connected) return socketRef.current

    const sock = io(SOCKET_URL, {
      auth:         { token },
      // Local: use websocket, Production: use polling (more reliable on Render)
      transports:   isLocal ? ["websocket"] : ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay:    2000,
      reconnectionAttempts: 5,
      timeout:              20000
    })

    sock.on("connect", () => {
      console.log("[Socket] Connected via:", sock.io.engine.transport.name)
      setConnected(true)
    })
    sock.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason)
      setConnected(false)
    })
    sock.on("connect_error", (err) => {
      console.warn("[Socket] Error:", err.message)
      setConnected(false)
    })

    socketRef.current = sock
    return sock
  }

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      connect,
      disconnect,
      SOCKET_URL
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error("useSocket must be used within SocketProvider")
  return ctx
}

export default SocketContext