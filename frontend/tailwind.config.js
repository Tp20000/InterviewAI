export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  safelist: [
    "badge-green", "badge-blue", "badge-red", "badge-yellow", "badge-purple",
    "btn-primary", "btn-secondary", "btn-danger",
    "card", "input-field",
    "text-green-400", "text-blue-400", "text-red-400",
    "text-yellow-400", "text-purple-400",
    "bg-green-500", "bg-yellow-500", "bg-red-500", "bg-blue-500"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in":     "fadeIn 0.3s ease forwards",
        "slide-up":    "slideUp 0.3s ease forwards"
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: 0, transform: "translateY(6px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(20px)" }, "100%": { opacity: 1, transform: "translateY(0)" } }
      }
    }
  },
  plugins: []
}