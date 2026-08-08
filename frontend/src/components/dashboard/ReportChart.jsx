const ReportChart = ({ data = [], height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-sm"
        style={{ height }}>
        No data available
      </div>
    )
  }

  const max = Math.max(...data.map(d => d.value || 0), 100)

  return (
    <div className="flex items-end gap-2 w-full" style={{ height }}>
      {data.map((item, i) => {
        const pct = ((item.value || 0) / max) * 100
        const color = (item.value || 0) >= 70 ? "bg-green-500"
          : (item.value || 0) >= 50 ? "bg-blue-500"
          : "bg-red-500"

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400 font-medium">
              {Math.round(item.value || 0)}%
            </span>
            <div className="w-full bg-slate-700 rounded-t-lg overflow-hidden"
              style={{ height: height - 40 }}>
              <div
                className={"w-full rounded-t-lg transition-all duration-700 " + color}
                style={{ height: pct + "%", marginTop: "auto" }}
              />
            </div>
            <span className="text-xs text-slate-500 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
export default ReportChart