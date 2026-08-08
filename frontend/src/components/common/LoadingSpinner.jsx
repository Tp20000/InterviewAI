const LoadingSpinner = ({ size = "md", text = "Loading..." }) => {
  const sizes = {
    xs:  "w-3 h-3 border",
    sm:  "w-4 h-4 border-2",
    md:  "w-8 h-8 border-2",
    lg:  "w-12 h-12 border-2",
    xl:  "w-16 h-16 border-4"
  }
  return (
    <div className="inline-flex flex-col items-center justify-center gap-3">
      <div className={
        (sizes[size] || sizes.md) +
        " animate-spin rounded-full border-slate-600 border-t-blue-500"
      } />
      {text && text.length > 0 && (
        <p className="text-slate-400 text-sm">{text}</p>
      )}
    </div>
  )
}
export default LoadingSpinner