import { createContext, useContext, useRef, useState, useEffect } from "react"
import { io } from "socket.io-client"
import { SOCKET_URL } from "../services/api"

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  const connect = (token) => {
    if (socketRef.current?.connected) return socketRef.current

    const sock = io(SOCKET_URL, {
      auth:         { token },
      transports:   ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      timeout:      10000
    })

    sock.on("connect",    () => {
      console.log("[Socket] Connected to", SOCKET_URL)
      setConnected(true)
    })
    sock.on("disconnect", () => {
      console.log("[Socket] Disconnected")
      setConnected(false)
    })
    sock.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message)
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