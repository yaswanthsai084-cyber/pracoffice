import { useNavigate } from "react-router-dom"
import { clearToken } from "../../services/authService"

function Header({ showLogout = false }) {

  const navigate = useNavigate()

  // Drop the session token and return to the login page.
  const handleLogout = () => {
    clearToken()
    navigate("/login")
  }

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-md">
            P
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              PracOffice
            </h1>

            <p className="text-xs text-slate-500">
              Practical Office Skills
            </p>
          </div>
        </div>

        {/* Header right side */}
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-500 sm:inline">
            Practice. Perform. Improve.
          </span>

          {showLogout && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            >
              Logout
            </button>
          )}
        </div>

      </div>
    </header>
  )
}

export default Header;