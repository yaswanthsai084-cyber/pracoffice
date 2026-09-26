import { useNavigate } from "react-router-dom"
import { clearToken } from "../../services/authService"
import "./header.css"

function Header({ showLogout = false, fullWidth = false }) {

  const navigate = useNavigate()

  // Drop the session token and return to the login page.
  const handleLogout = () => {
    clearToken()
    navigate("/login")
  }

  return (
    <header className="site-header border-b backdrop-blur-md">
      <div className={`${fullWidth ? "w-full" : "mx-auto max-w-7xl"} flex items-center justify-between px-6 py-4 lg:px-8`}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="header-logo-badge flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white">
            P
          </div>

          <div>

            <h1 className="header-title text-xl font-bold tracking-tight">
              Proficiency in Office Automation
            </h1>

            <p className="header-subtitle text-xs">
              Online Exam for Qualifying the Test
            </p>
          </div>
        </div>

        {/* Header right side */}
        <div className="flex items-center gap-4">
          <span className="header-tagline hidden text-sm sm:inline">
            Online Exam · Proficiency in Office Automation
          </span>

          {showLogout && (
            <button
              type="button"
              onClick={handleLogout}
              className="header-logout-btn rounded-xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus:outline-none"
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