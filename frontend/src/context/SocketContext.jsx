import { createContext, useContext, useRef, useState, useEffect } from "react"
import { io } from "socket.io-client"

const SocketContext = createContext(null)

const SOCKET_URL = "http://localhost:5000"

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Connect when token is available
    const token = localStorage.getItem("access_token")
    if (token && !socketRef.current) {
      connect(token)
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  const connect = (token) => {
    if (socketRef.current) return

    const sock = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000
    })

    sock.on("connect",    () => setConnected(true))
    sock.on("disconnect", () => setConnected(false))

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

  const emit = (event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data)
    }
  }

  const on = (event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler)
    }
  }

  const off = (event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler)
    }
  }

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      connect,
      disconnect,
      emit,
      on,
      off
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