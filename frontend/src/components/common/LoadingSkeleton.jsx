const LoadingSkeleton = ({ rows = 3, type = "list" }) => {
  if (type === "stat") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 animate-pulse">
            <div className="h-3 bg-slate-700 rounded w-20 mb-3" />
            <div className="h-8 bg-slate-700 rounded w-16 mb-2" />
            <div className="h-2 bg-slate-700 rounded w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (type === "card") {
    return (
      <div className="card animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl mb-2">
            <div className="w-10 h-10 bg-slate-700 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-slate-700 rounded w-48 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-32" />
            </div>
            <div className="w-20 h-8 bg-slate-700 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-700 rounded" style={{
          width: (70 + Math.random() * 30) + "%"
        }} />
      ))}
    </div>
  )
}
export default LoadingSkeleton