import { Link, useNavigate } from "react-router-dom"
import Header from "../components/common/Header"
import Footer from "../components/common/Footer"
import "./registration.css"

function Registration() {
  const navigate = useNavigate()

  const handleSubmit = (event) => {
    event.preventDefault()

    const form = event.target

    const username = form.username.value.trim()
    const mobileNumber = form.mobileNumber.value.trim()
    const email = form.email.value.trim()
    const dateOfBirth = form.dateOfBirth.value

    // Only continue when every field is filled in.
    if (!username || !mobileNumber || !email || !dateOfBirth) {
      return
    }

    console.log("Registration form submitted")

    navigate("/login")
  }

  return (
    <div className="registration-page flex min-h-screen flex-col bg-slate-50">

      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">

        <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-2">

          {/* Left Section */}
          <div className="registration-hero relative hidden overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">

            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />

            <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/10" />

            <div className="relative z-10">

              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur-sm">
                P
              </div>

              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-200">
                Join PracOffice
              </p>

              <h2 className="max-w-md text-4xl font-bold leading-tight">
                Build your practical skills with confidence.
              </h2>

              <p className="mt-6 max-w-md text-base leading-7 text-indigo-100">
                Create your account and start practicing real-world
                Microsoft Office skills through practical assessments.
              </p>

            </div>

            {/* Features */}
            <div className="relative z-10 space-y-3">

              <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-semibold">
                  ✓
                </div>

                <div>
                  <p className="font-medium">
                    Practical assessments
                  </p>

                  <p className="text-xs text-indigo-200">
                    Learn by performing real tasks
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-semibold">
                  ✓
                </div>

                <div>
                  <p className="font-medium">
                    Track your performance
                  </p>

                  <p className="text-xs text-indigo-200">
                    Understand your practical skills
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* Right Section */}
          <div className="p-6 sm:p-10 lg:p-12">

            <div className="mx-auto max-w-md">

              {/* Heading */}
              <div className="mb-8">

                <p className="mb-2 text-sm font-semibold text-indigo-600">
                CREATE ACCOUNT 
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Get started
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Create your PracOffice account to begin your practical
                  skills assessment.
                </p>

              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Username */}
                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Username
                  </label>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Enter your username"
                    required
                    className="registration-input w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label
                    htmlFor="mobileNumber"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Mobile Number
                  </label>

                  <input
                    id="mobileNumber"
                    name="mobileNumber"
                    type="tel"
                    inputMode="numeric"
                    maxLength="10"
                    placeholder="Enter your 10-digit mobile number"
                    required
                    className="registration-input w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    This mobile number will be used as your login password.
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email Address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email address"
                    required
                    className="registration-input w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label
                    htmlFor="dateOfBirth"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Date of Birth
                  </label>

                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    required
                    className="registration-input w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                {/* Register Button */}
                <button
                  type="submit"
                  className="registration-btn w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                >
                  Create Account
                </button>

              </form>

              {/* Login link */}
              <div className="mt-8 text-center text-sm text-slate-500">
                Already have an account?{" "}
               <Link
                to="/login"
                className="font-semibold text-indigo-600 hover:text-indigo-700">
                      Sign in
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

export default Registration