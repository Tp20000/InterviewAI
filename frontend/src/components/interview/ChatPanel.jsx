import { useEffect, useRef } from "react"

const ChatPanel = ({ messages = [], isThinking = false, questionNumber = 0 }) => {
  const bottomRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isThinking])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4 chat-scroll">

        {messages.length === 0 && !isThinking && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-slate-400 text-sm">
                Alex will greet you shortly...
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}
            className={"flex animate-fade-in " + (
              msg.role === "ai" ? "justify-start" : "justify-end"
            )}>
            {msg.role === "ai" && (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1 shadow-lg">
                🤖
              </div>
            )}
            <div className={"max-w-[80%] rounded-2xl px-4 py-3 shadow-sm " + (
              msg.role === "ai"
                ? "bg-slate-700 text-white rounded-tl-none"
                : "bg-blue-600 text-white rounded-tr-none"
            )}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
              {msg.timestamp && (
                <p className="text-xs opacity-40 mt-1 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              )}
            </div>
            {msg.role === "candidate" && (
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm ml-2 flex-shrink-0 mt-1 shadow-lg">
                👤
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex justify-start animate-fade-in">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
              🤖
            </div>
            <div className="bg-slate-700 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i}
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: i * 0.15 + "s" }}
                    />
                  ))}
                  <span className="text-slate-400 text-xs ml-1">
                    Alex is thinking...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
export default ChatPanel