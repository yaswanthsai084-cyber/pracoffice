import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import "./header.css"

function Header({ showLogout = false, fullWidth = false }) {

  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuth()

  // End the session and return to the dashboard (the site landing page).
  const handleLogout = () => {
    logout()
    navigate("/dashboard", { replace: true })
  }

  return (
    <header className="site-header border-b backdrop-blur-md">

      {/* Thin gradient accent along the top edge */}
      <span className="header-accent block w-full" aria-hidden="true" />

      <div className={`${fullWidth ? "w-full" : "mx-auto max-w-7xl"} flex items-center justify-between gap-4 px-6 py-4 lg:px-8`}>

        {/* Brand: gradient logo badge + title */}
        <div className="flex min-w-0 items-center gap-3">

          <div className="header-logo-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white">
            P
          </div>

          <div className="min-w-0">

            <h1 className="header-title truncate text-lg font-bold tracking-tight sm:text-xl">
              Proficiency in Office Automation
            </h1>

            <p className="header-subtitle hidden text-[10px] font-semibold uppercase tracking-[0.18em] sm:block">
              Online Exam for Qualifying the Test
            </p>

          </div>

        </div>

        {/* Right side: status pill + logout */}
        <div className="flex shrink-0 items-center gap-3">

          <span className="header-pill hidden items-center rounded-full px-3.5 py-1.5 text-xs font-semibold lg:inline-flex">
            <span className="header-pill-dot mr-2 h-1.5 w-1.5 rounded-full" />
            Online Exam
          </span>

          {showLogout && isAuthenticated && (
            <button
              type="button"
              onClick={handleLogout}
              className="header-logout-btn rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 focus:outline-none"
            >
              Logout
            </button>
          )}

        </div>

      </div>

    </header>
  )
}

export default Header
