import { useState } from "react"
import { Link, useNavigate} from "react-router-dom"
import { useState } from "react"
import Header from "../components/common/Header"
import Footer from "../components/common/Footer"
import { loginUser, saveToken, describeError } from "../services/authService"
import "./login.css"

function Login() {

  const navigate = useNavigate()

  // Toggles between masked (dots) and visible password/mobile number.
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()

    const username = event.target.username.value.trim()
    const password = event.target.password.value.trim()

    // Only continue when both fields are filled in.
    if (!username || !password) {
      return
    }

    setError("")
    setSubmitting(true)

    try {
      // POST /api/auth/login - the password is the registered mobile number.
      const session = await loginUser({ username, password })
      saveToken(session.token)
      navigate("/dashboard")
    } catch (requestError) {
      setError(describeError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page flex min-h-screen flex-col bg-page">

      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">

        <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-surface shadow-xl shadow-slate-200/60 lg:grid-cols-2">

          {/* Left Section */}
          <div className="login-hero relative hidden overflow-hidden bg-gradient-to-br from-brand to-brand-dark p-10 text-white lg:flex lg:flex-col lg:justify-between">

            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />

            <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/10" />

            <div className="relative z-10">

              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur-sm">
                P
              </div>

              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-light">
                Welcome to PracOffice
              </p>

              <h2 className="max-w-md text-4xl font-bold leading-tight">
                Practice the skills you use in the real world.
              </h2>

              <p className="mt-6 max-w-md text-base leading-7 text-indigo-100">
                Improve your practical skills across Microsoft Office
                applications and understand how effectively you perform
                real-world tasks.
              </p>

            </div>

            <div className="relative z-10 grid grid-cols-3 gap-3">

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-lg font-semibold">Word</p>
                <p className="mt-1 text-xs text-brand-light">
                  Documents
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-lg font-semibold">Excel</p>
                <p className="mt-1 text-xs text-brand-light">
                  Data & formulas
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-lg font-semibold">Access</p>
                <p className="mt-1 text-xs text-brand-light">
                  Databases
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-lg font-semibold">PowerPoint</p>
                <p className="mt-1 text-xs text-brand-light">
                  presentations
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-lg font-semibold">Email</p>
                <p className="mt-1 text-xs text-brand-light">
                  email interfaces
                </p>
              </div>

            </div>

          </div>

          {/* Right Section */}
          <div className="p-6 sm:p-10 lg:p-12">

            <div className="mx-auto max-w-md">

              <div className="mb-8">

                <p className="mb-2 text-sm font-semibold text-brand">
                  LOGIN
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-text-primary">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Sign in to continue your practical skills assessment.
                </p>

              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Username */}
                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Username
                  </label>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Enter your username"
                    required
                    className="login-input w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                </div>

                {/* Password / Mobile Number */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Password
                    </label>

                    <span className="text-xs text-text-muted">
                      Mobile number
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      inputMode="numeric"
                      autoComplete="current-password"
                      maxLength="10"
                      placeholder="Enter your mobile number"
                      required
                      className="login-input w-full rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-4 focus:ring-brand/10"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition hover:bg-slate-100 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      {showPassword ? (
                        // Eye with slash - click to hide
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <path d="M6.61 6.61A18.15 18.15 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      ) : (
                        // Open eye - click to show
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M1.5 12S4.5 4 12 4s10.5 8 10.5 8-3 8-10.5 8S1.5 12 1.5 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-text-muted">
                    Your registered mobile number is used as your password.
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {error}
                  </div>
                )}

                {/* Login button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="login-btn w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>

              </form>

              {/* Registration link */}
              <div className="mt-8 text-center text-sm text-text-secondary">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-brand hover:text-brand-dark"
                >
                  Create an account
                </Link>
              </div>

            </div>

          </div>

        </div>

      </main>

      <Footer />

    </div>
  )
}

export default Login